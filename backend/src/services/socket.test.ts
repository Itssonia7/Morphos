import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeSocket, emitGraphState, initSocket, type GraphUpdateEvent } from './socket.js';

vi.mock('firebase-admin', () => ({
  default: {
    auth: () => ({
      verifyIdToken: async (token: string) => {
        if (token === 'valid-user-a') return { uid: 'user-a' };
        if (token === 'valid-user-b') return { uid: 'user-b' };
        throw new Error('Invalid token');
      },
    }),
  },
}));

describe('WebSocket Telemetry Service', () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    initSocket(httpServer, 'http://localhost:5173');
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const port = (httpServer.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    await closeSocket();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('rejects unauthenticated socket connections', async () => {
    const client = createClient(baseUrl, { autoConnect: false, reconnection: false });
    clients.push(client);

    const err = await new Promise<Error>((resolve) => {
      client.on('connect_error', resolve);
      client.connect();
    });

    expect(err.message).toContain('Authentication required');
  });

  it('scopes graph updates strictly to the target user/run room', async () => {
    const clientA = createClient(baseUrl, {
      auth: { token: 'valid-user-a' },
      reconnection: false,
    });
    const clientB = createClient(baseUrl, {
      auth: { token: 'valid-user-b' },
      reconnection: false,
    });
    clients.push(clientA, clientB);

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', resolve)),
      new Promise<void>((resolve) => clientB.on('connect', resolve)),
    ]);

    const receivedByB: GraphUpdateEvent[] = [];
    clientB.on('graph_update', (evt: GraphUpdateEvent) => receivedByB.push(evt));

    const receivedByA = new Promise<GraphUpdateEvent>((resolve) => {
      clientA.on('graph_update', resolve);
    });

    emitGraphState(
      'run-123',
      'generateHypotheses',
      {
        runId: 'run-123',
        stage: 'generateHypotheses',
        status: 'hypotheses_ready',
        timestamp: new Date().toISOString(),
      },
      'user-a',
    );

    const event = await receivedByA;
    expect(event.runId).toBe('run-123');
    expect(event.state).toBe('generateHypotheses');
    expect(receivedByB).toHaveLength(0);
  });
});
