/**
 * File README
 * What this file does: simulates a deterministic network latency trace for a target API endpoint.
 * Why it exists: gives the investigation agent reproducible DNS, TCP, TLS, and TTFB telemetry without external network dependencies.
 * Data in: an API endpoint path or URL string.
 * Data out: a deterministic JSON payload with stage-by-stage timing breakdowns, bottleneck classification, and status diagnostics.
 * LangGraph connection: invoked by executeExperiment when selectExperiment chooses network_trace for endpoint or gateway latency investigations.
 */
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

function computeDeterministicHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const networkTraceTool = tool(
  async ({ endpoint }: { endpoint: string }) => {
    const normalized = endpoint.trim();
    if (!normalized) {
      return JSON.stringify({
        ok: false,
        error: 'Endpoint must be a non-empty path or URL.',
      });
    }

    const lower = normalized.toLowerCase();
    const hash = computeDeterministicHash(lower);

    const isHealthEndpoint = /\/health|\/ping|\/status|\/ready/.test(lower);
    const isHeavyEndpoint = /checkout|order|payment|search|report|export|analytics|query|auth/.test(lower);

    const dnsResolutionMs = isHealthEndpoint ? 6 + (hash % 5) : 10 + (hash % 15);
    const tcpHandshakeMs = isHealthEndpoint ? 12 + ((hash >>> 4) % 10) : 22 + ((hash >>> 4) % 28);
    const tlsHandshakeMs = isHealthEndpoint ? 16 + ((hash >>> 8) % 12) : 28 + ((hash >>> 8) % 34);
    const ttfbMs = isHealthEndpoint
      ? 24 + ((hash >>> 12) % 30)
      : isHeavyEndpoint
      ? 620 + ((hash >>> 12) % 260)
      : 180 + ((hash >>> 12) % 220);

    const totalLatencyMs = dnsResolutionMs + tcpHandshakeMs + tlsHandshakeMs + ttfbMs;
    const isHighTtfb = ttfbMs >= 500;
    const bottleneckStage = isHighTtfb
      ? 'upstream_ttfb'
      : tcpHandshakeMs + tlsHandshakeMs > 85
      ? 'tcp_tls'
      : 'healthy';

    const status = isHighTtfb
      ? 'Warning: High TTFB detected. Potential upstream handler or database connection pool bottleneck.'
      : 'Healthy: Network handshake and upstream TTFB within expected thresholds.';

    return JSON.stringify({
      ok: true,
      endpoint: normalized,
      dnsResolutionMs,
      tcpHandshakeMs,
      tlsHandshakeMs,
      ttfbMs,
      totalLatencyMs,
      latencyMs: totalLatencyMs,
      dnsResolution: `${dnsResolutionMs}ms`,
      tcpHandshake: `${tcpHandshakeMs}ms`,
      tlsHandshake: `${tlsHandshakeMs}ms`,
      ttfb: `${ttfbMs}ms`,
      bottleneckStage,
      status,
      metrics: {
        dnsResolutionMs,
        tcpHandshakeMs,
        tlsHandshakeMs,
        ttfbMs,
        totalLatencyMs,
      },
    });
  },
  {
    name: 'network_trace',
    description: 'Simulates a deterministic network latency trace (DNS, TCP, TLS, TTFB) against a given API endpoint.',
    schema: z.object({
      endpoint: z.string().describe('Target API endpoint path or URL, such as /api/v1/checkout'),
    }),
  },
);
