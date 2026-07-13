import type { Server as SocketIOServer } from 'socket.io';

export function broadcastBoardUpdate(io: SocketIOServer, board: unknown): void {
  io.emit('board:update', board);
}

export function broadcastQueueUpdate(io: SocketIOServer, queue: unknown): void {
  io.to('admin').emit('queue:update', queue);
}

export function broadcastConnectionStatus(io: SocketIOServer, status: string): void {
  io.to('admin').emit('connection:status', status);
}

export function broadcastRouletteResult(io: SocketIOServer, result: unknown): void {
  io.emit('roulette:result', result);
}
