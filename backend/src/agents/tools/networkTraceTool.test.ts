import { describe, expect, it } from 'vitest';
import { networkTraceTool } from './networkTraceTool.js';

describe('networkTraceTool', () => {
  it('returns identical deterministic trace metrics for the same endpoint', async () => {
    const first = JSON.parse(String(await networkTraceTool.invoke({ endpoint: '/api/v1/checkout' })));
    const second = JSON.parse(String(await networkTraceTool.invoke({ endpoint: '/api/v1/checkout' })));

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      endpoint: '/api/v1/checkout',
      bottleneckStage: 'upstream_ttfb',
    });
    expect(first.ttfbMs).toBeGreaterThanOrEqual(500);
    expect(first.totalLatencyMs).toBe(
      first.dnsResolutionMs + first.tcpHandshakeMs + first.tlsHandshakeMs + first.ttfbMs,
    );
  });

  it('distinguishes healthy lightweight endpoints from bottlenecked endpoints', async () => {
    const health = JSON.parse(String(await networkTraceTool.invoke({ endpoint: '/api/health' })));
    const orders = JSON.parse(String(await networkTraceTool.invoke({ endpoint: '/api/v1/orders' })));

    expect(health.ok).toBe(true);
    expect(health.bottleneckStage).toBe('healthy');
    expect(health.ttfbMs).toBeLessThan(100);
    expect(orders.ttfbMs).toBeGreaterThan(health.ttfbMs);
  });

  it('returns an error payload when given an empty endpoint', async () => {
    const result = JSON.parse(String(await networkTraceTool.invoke({ endpoint: '   ' })));
    expect(result.ok).toBe(false);
  });
});
