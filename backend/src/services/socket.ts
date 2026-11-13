import type { Server as HttpServer } from 'node:http';
import admin from 'firebase-admin';
import { Server, type Socket } from 'socket.io';

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

interface AuthenticatedSocketData {
  uid: string;
}

let io: Server | null = null;

function extractSocketToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    return authToken.startsWith('Bearer ') ? authToken.slice(7).trim() : authToken.trim();
  }

  const header = socket.handshake.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }

  return null;
}

export const initSocket = (server: HttpServer, frontendOrigin: string): Server => {
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const isProduction = process.env.NODE_ENV === 'production';
        const isConfiguredOrigin =
          origin === frontendOrigin && (!isProduction || frontendOrigin.startsWith('https://'));
        const isLocalDev = !isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        return callback(null, isConfiguredOrigin || isLocalDev);
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate every WebSocket connection via Firebase ID token
  io.use(async (socket, next) => {
    const token = extractSocketToken(socket);
    if (!token) {
      return next(new Error('Authentication required.'));
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      if (!decoded?.uid) {
        return next(new Error('Invalid Firebase token payload.'));
      }
      (socket.data as AuthenticatedSocketData).uid = decoded.uid;
      return next();
    } catch {
      return next(new Error('Invalid or expired Firebase token.'));
    }
  });

  io.on('connection', (socket) => {
    const { uid } = socket.data as AuthenticatedSocketData;
    socket.join(`user:${uid}`);

    socket.on('subscribe_run', (runId: unknown) => {
      if (typeof runId === 'string' && runId.trim().length > 0) {
        socket.join(`run:${runId.trim()}`);
      }
    });

    socket.on('unsubscribe_run', (runId: unknown) => {
      if (typeof runId === 'string' && runId.trim().length > 0) {
        socket.leave(`run:${runId.trim()}`);
      }
    });
  });

  return io;
};

export const closeSocket = async (): Promise<void> => {
  if (io) {
    await io.close();
    io = null;
  }
};

// Emit real-time LangGraph state transitions strictly to scoped user / run rooms
export const emitGraphState = (
  runId: string,
  state: string,
  data: GraphStatePayload,
  userId?: string,
): void => {
  if (!io) return;

  const rooms: string[] = [`run:${runId}`];
  if (userId) {
    rooms.push(`user:${userId}`);
  }

  const event: GraphUpdateEvent = {
    runId,
    state,
    data,
    timestamp: Date.now(),
  };

  io.to(rooms).emit('graph_update', event);
};
