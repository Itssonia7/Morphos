import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initSocket = (server: HttpServer, frontendOrigin: string) => {
  io = new Server(server, {
    cors: { origin: frontendOrigin, methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[Socket] Disconnected: ${socket.id}`));
  });
  
  return io;
};

// Emit real-time LangGraph state transitions to the React frontend
export const emitGraphState = (runId: string, state: string, data: any) => {
  if (io) {
    io.emit(`graph_update_${runId}`, { state, data, timestamp: Date.now() });
  }
};
