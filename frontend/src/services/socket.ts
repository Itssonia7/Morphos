import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type GraphStageStatus =
  | 'starting'
  | 'hypotheses_ready'
  | 'experiment_selected'
  | 'experiment_executed'
  | 'results_analyzed'
  | 'confidence_evaluated'
  | 'completed'
  | string;

export interface GraphStatePayload {
  runId: string;
  stage: string;
  status: GraphStageStatus;
  domain?: string;
  confidence?: number;
  iteration?: number;
  message?: string;
  timestamp: string;
}

export interface GraphUpdateEvent {
  runId: string;
  state: string;
  data: GraphStatePayload;
  timestamp: number;
}

const NODE_STAGE_INDEX: Record<string, number> = {
  started: 0,
  interpretQuestion: 1,
  generateHypotheses: 2,
  selectExperiment: 3,
  executeExperiment: 4,
  analyzeResults: 5,
  evaluateConfidence: 6,
  finalize: 7,
};

export function getStageIndexFromNode(nodeName: string): number {
  return NODE_STAGE_INDEX[nodeName] ?? -1;
}

function getSocketBaseUrl(): string {
  let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  return baseUrl;
}

export function createTelemetrySocket(authToken: string): Socket {
  return io(getSocketBaseUrl(), {
    auth: { token: authToken },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}

export function subscribeToGraphUpdates(
  authToken: string,
  onUpdate: (event: GraphUpdateEvent) => void,
  runId?: string,
): () => void {
  const socket = createTelemetrySocket(authToken);

  socket.on('connect', () => {
    if (runId) {
      socket.emit('subscribe_run', runId);
    }
  });

  socket.on('graph_update', (event: GraphUpdateEvent) => {
    if (!runId || event.runId === runId) {
      onUpdate(event);
    }
  });

  return () => {
    if (runId && socket.connected) {
      socket.emit('unsubscribe_run', runId);
    }
    socket.disconnect();
  };
}

export function useGraphTelemetry(authToken: string | null, runId?: string) {
  const [latestUpdate, setLatestUpdate] = useState<GraphUpdateEvent | null>(null);
  const [events, setEvents] = useState<GraphStatePayload[]>([]);

  useEffect(() => {
    if (!authToken) {
      return undefined;
    }

    return subscribeToGraphUpdates(
      authToken,
      (event) => {
        setLatestUpdate(event);
        setEvents((prev) => [...prev, event.data]);
      },
      runId,
    );
  }, [authToken, runId]);

  return { latestUpdate, events };
}
