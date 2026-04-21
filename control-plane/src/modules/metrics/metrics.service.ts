import { Injectable } from "@nestjs/common";

/**
 * Tiny in-process counters exposed at /metrics in Prometheus format.
 * Zero-dep by design — our metric surface is small (< 20 series), so
 * pulling in prom-client would be overkill.
 *
 * Keys are `name{label1="v1",label2="v2",…}` joined with sorted labels so
 * two increments with the same (name, labels) coalesce in the same bucket.
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly helpLines = new Map<string, string>();

  /** Optional: register a HELP doc line for a metric name. */
  describe(name: string, help: string): void {
    this.helpLines.set(name, help);
  }

  /** Increment a counter by `delta` (default 1). */
  increment(name: string, labels: Record<string, string> = {}, delta = 1): void {
    const key = this.keyFor(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + delta);
  }

  /** Render all counters in Prometheus 0.0.4 exposition format. */
  render(): string {
    const byMetric = new Map<string, string[]>();
    for (const [key, value] of this.counters) {
      const name = key.split("{", 2)[0];
      if (!name) continue;
      const lines = byMetric.get(name) ?? [];
      lines.push(`${key} ${value}`);
      byMetric.set(name, lines);
    }

    const parts: string[] = [];
    for (const [name, lines] of byMetric) {
      const help = this.helpLines.get(name);
      if (help) parts.push(`# HELP ${name} ${help}`);
      parts.push(`# TYPE ${name} counter`);
      parts.push(...lines);
    }
    return parts.join("\n") + "\n";
  }

  private keyFor(name: string, labels: Record<string, string>): string {
    const sorted = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`);
    return sorted.length ? `${name}{${sorted.join(",")}}` : name;
  }
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}
