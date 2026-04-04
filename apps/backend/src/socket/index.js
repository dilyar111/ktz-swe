const { Server } = require('socket.io');

/**
 * WebSocket gateway — без JWT на старте (добавить после интеграции auth из MedWaste).
 * @param {import('http').Server} httpServer
 * @param {string} clientUrl
 */
function initSocket(httpServer, clientUrl) {
  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.emit('connection:status', { ok: true, at: new Date().toISOString() });
    socket.on('disconnect', () => {});
  });

  return io;
}

/**
 * @param {import('socket.io').Server | null} io
 * @param {string} event
 * @param {object} payload
 */
function emitToAll(io, event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

module.exports = { initSocket, emitToAll };
