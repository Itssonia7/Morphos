import { describe, expect, it } from 'vitest';
import { logAnalyzerTool } from './logAnalyzerTool.js';

describe('logAnalyzerTool', () => {
  it('returns identical deterministic log analysis results for identical inputs', async () => {
    const first = JSON.parse(
      String(await logAnalyzerTool.invoke({ query: 'connection pool timeout', timeframe: '15m' })),
    );
    const second = JSON.parse(
      String(await logAnalyzerTool.invoke({ query: 'connection pool timeout', timeframe: '15m' })),
    );

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      query: 'connection pool timeout',
      timeframe: '15m',
      errorCode: 'ERR_DB_POOL_EXHAUSTED',
      severity: 'CRITICAL',
      affectedService: 'postgres-primary',
    });
    expect(first.sampleEntries.length).toBe(2);
  });

  it('scales match counts deterministically with the requested timeframe', async () => {
    const shortWindow = JSON.parse(
      String(await logAnalyzerTool.invoke({ query: '504 upstream gateway', timeframe: '5m' })),
    );
    const longWindow = JSON.parse(
      String(await logAnalyzerTool.invoke({ query: '504 upstream gateway', timeframe: '1h' })),
    );

    expect(shortWindow.ok).toBe(true);
    expect(longWindow.ok).toBe(true);
    expect(longWindow.matches).toBeGreaterThan(shortWindow.matches);
    expect(longWindow.errorCode).toBe('ERR_UPSTREAM_TIMEOUT');
  });

  it('returns an error payload when query is blank', async () => {
    const result = JSON.parse(String(await logAnalyzerTool.invoke({ query: '   ', timeframe: '15m' })));
    expect(result.ok).toBe(false);
  });
});
