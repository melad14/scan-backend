const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Technician = require('../models/Technician');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, env.jwt.accessSecret);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Token invalid'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`);

    // 1. Patient joins tracking room
    socket.on('join:order', (orderId) => {
      const room = `order:${orderId}:patient`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined patient room: ${room}`);
    });

    // 2. Technician joins tracking room
    socket.on('join:order:tech', (orderId) => {
      const room = `order:${orderId}:tech`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined tech room: ${room}`);
    });

    // 3. Technician location broadcast (Phase 2 feature, disabled behind flag)
    socket.on('tech:location', async ({ orderId, lat, lng }) => {
      // Check feature flag
      if (!env.features.realtimeTracking) {
        console.log('[Socket] Location update received but Real-time Tracking is disabled via Feature Flag.');
        return;
      }

      console.log(`[Socket] Tech Location update for Order ${orderId}: [${lat}, ${lng}]`);

      // Broadcast location to patient room
      io.to(`order:${orderId}:patient`).emit('tech:location', { lat, lng });

      // Save GPS update to DB for technician
      try {
        await Technician.findByIdAndUpdate(socket.user.id, {
          $set: {
            currentLocation: {
              type: 'Point',
              coordinates: [lng, lat]
            }
          }
        });
      } catch (err) {
        console.error('Error saving tech location from socket:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Global broadcast function for status updates
const emitOrderStatus = (orderId, status, data = {}) => {
  if (io) {
    io.to(`order:${orderId}:patient`).emit('order:status', { status, ...data });
    console.log(`[Socket Broadcast] Order ${orderId} status changed to ${status}`);
  }
};

module.exports = {
  initSocket,
  emitOrderStatus,
  getIo: () => io
};
