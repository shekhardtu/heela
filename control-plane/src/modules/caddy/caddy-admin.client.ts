import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { request as httpRequest } from "node:http";

/**
 * Thin client for Caddy's Admin API (https://caddyserver.com/docs/api).
 *
 * Transport: we prefer a Unix socket (CADDY_ADMIN_URL=unix:/run/caddy/admin.sock)
 * so the control-plane container talks to Caddy through a mounted volume
 * rather than TCP. This removes the TCP exposure, iptables rules, and
 * Origin-header allow-list that were needed for the previous bridge-gateway
 * approach — file permissions alone gate access.
 *
 * TCP (http://host:port) is still supported for local dev or alternate
 * deploys where a socket isn't practical.
 */
@Injectable()
export class CaddyAdminClient {
  private readonly log = new Logger(CaddyAdminClient.name);
  private readonly adminUrl: string;
  private readonly transport: "unix" | "tcp";
  private readonly socketPath: string | null;
  private readonly tcpBase: string | null;

  constructor(private readonly config: ConfigService) {
    this.adminUrl = this.config.get<string>("CADDY_ADMIN_URL") ?? "http://localhost:2019";

    if (this.adminUrl.startsWith("unix:")) {
      this.transport = "unix";
      // Accept both `unix:/path` and `unix:///path` forms.
      this.socketPath = this.adminUrl.replace(/^unix:\/{0,2}/, "/");
      this.tcpBase = null;
    } else {
      this.transport = "tcp";
      this.socketPath = null;
      this.tcpBase = this.adminUrl.replace(/\/$/, "");
    }
  }

  /** Read config at a given path. Returns null if Caddy has nothing there. */
  async getConfig<T>(path: string): Promise<T | null> {
    const { status, body } = await this.send("GET", path);
    if (status === 404) return null;
    if (status < 200 || status >= 300) {
      this.log.error(`caddy admin GET ${path} → ${status}: ${body}`);
      throw new Error(`caddy admin GET rejected at ${path}: ${status}`);
    }
    if (!body || body === "null") return null;
    return JSON.parse(body) as T;
  }

  /**
   * Replace the config at a given path atomically. Caddy validates + hot-
   * reloads in one step; failure returns 400 with the validation error so
   * we can surface it to the operator.
   */
  async putConfig(path: string, body: unknown): Promise<void> {
    const { status, body: responseBody } = await this.send(
      "POST",
      path,
      JSON.stringify(body),
    );
    if (status < 200 || status >= 300) {
      this.log.error(`caddy admin ${path} → ${status}: ${responseBody}`);
      throw new Error(`caddy admin rejected config at ${path}: ${status}`);
    }
    this.log.debug(`caddy admin ${path} → ${status}`);
  }

  /** Health-check the admin API. Used by the reconciler to bail early. */
  async ping(): Promise<boolean> {
    try {
      const { status } = await this.send("GET", "/config/");
      return status >= 200 && status < 300;
    } catch {
      return false;
    }
  }

  /**
   * Transport-agnostic HTTP call. Unix-socket path uses node:http's
   * `socketPath` option; TCP path goes through the global fetch.
   */
  private send(
    method: string,
    path: string,
    body?: string,
  ): Promise<{ status: number; body: string }> {
    if (this.transport === "unix") {
      return this.sendViaSocket(method, path, body);
    }
    return this.sendViaTcp(method, path, body);
  }

  private sendViaSocket(
    method: string,
    path: string,
    body?: string,
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          socketPath: this.socketPath!,
          method,
          path,
          headers: {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
        },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
        },
      );
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  }

  private async sendViaTcp(
    method: string,
    path: string,
    body?: string,
  ): Promise<{ status: number; body: string }> {
    const res = await fetch(`${this.tcpBase}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        // Caddy's admin API checks Origin when bound to non-loopback TCP.
        // Matching our own baseUrl keeps the admin `origins` directive tight.
        Origin: this.tcpBase!,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
    });
    const text = await res.text().catch(() => "");
    return { status: res.status, body: text };
  }
}
