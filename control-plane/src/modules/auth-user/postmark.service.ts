import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ServerClient } from "postmark";

/**
 * Thin wrapper over the Postmark transactional client. Single responsibility:
 * send the magic-link email. Initialization is lazy so the server boots even
 * when POSTMARK_SERVER_TOKEN is unset during dev — calls just log + no-op in
 * that case (useful for local iteration without hitting a real email provider).
 */
@Injectable()
export class PostmarkService implements OnModuleInit {
  private readonly logger = new Logger(PostmarkService.name);
  private client: ServerClient | null = null;
  private fromAddress = "Hee <auth@hee.la>";
  private streamId = "outbound";

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const token = this.config.get<string>("POSTMARK_SERVER_TOKEN");
    if (!token) {
      this.logger.warn(
        "POSTMARK_SERVER_TOKEN not set — magic-link emails will be logged instead of sent",
      );
      return;
    }
    this.client = new ServerClient(token);
    const fromEnv = this.config.get<string>("POSTMARK_FROM_ADDRESS");
    if (fromEnv) this.fromAddress = fromEnv;
    const stream = this.config.get<string>("POSTMARK_STREAM_ID");
    if (stream) this.streamId = stream;
    this.logger.log(
      `Postmark initialized — from="${this.fromAddress}" stream="${this.streamId}"`,
    );
  }

  async sendMagicLink(params: {
    to: string;
    link: string;
    ip: string | null;
  }): Promise<void> {
    const subject = "Sign in to Hee";
    const textBody = `Use this link to sign in (expires in 15 minutes):\n\n${params.link}\n\n` +
      `If you didn't request this, ignore this email. Requested from IP ${params.ip ?? "unknown"}.`;
    const htmlBody = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;color:#0f172a">
        <h2 style="margin:0 0 8px 0">Sign in to Hee</h2>
        <p style="color:#475569;margin:0 0 24px">Click the button below to finish signing in. The link expires in 15 minutes.</p>
        <p><a href="${params.link}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f172a;color:#fff;text-decoration:none;font-weight:500">Sign in</a></p>
        <p style="margin-top:24px;color:#94a3b8;font-size:12px">If the button doesn't work, paste this into your browser:<br/><span style="word-break:break-all">${params.link}</span></p>
        <p style="margin-top:24px;color:#94a3b8;font-size:12px">Didn't request this? You can safely ignore this email. Requested from IP ${params.ip ?? "unknown"}.</p>
      </div>`;

    if (!this.client) {
      this.logger.log(`[dev] would send magic link to ${params.to}: ${params.link}`);
      return;
    }

    try {
      await this.client.sendEmail({
        From: this.fromAddress,
        To: params.to,
        Subject: subject,
        TextBody: textBody,
        HtmlBody: htmlBody,
        MessageStream: this.streamId,
      });
    } catch (err) {
      this.logger.error(`Postmark send failed for ${params.to}`, err as Error);
      throw err;
    }
  }
}
