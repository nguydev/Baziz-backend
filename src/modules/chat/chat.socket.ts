/**
 * Socket.io — real-time chat events with JWT auth + Redis adapter
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import User from '../user/user.model';
import { verifyAccessToken, isTokenBlacklisted } from '../../utils/tokenManager';
import { ensureRedisReady, getRedisClient } from '../../config/redis';
import { createAdapter } from '@socket.io/redis-adapter';
import logger from '../../config/logger';
import env from '../../config/env';
import Conversation from './conversation.model';
import { ensureParticipant } from './chat.helpers';

let io: Server | null = null;

const typingUsers = new Map<string, Map<string, NodeJS.Timeout>>();

export const getIO = (): Server | null => io;

export const emitChatEvent = (
  event: string,
  data: unknown,
  room: string
): void => {
  if (!io) return;
  io.to(room).emit(event, data);
};

const extractSocketToken = (socket: Socket): string | undefined => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const headerToken = socket.handshake.headers.token;
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === 'string') {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return undefined;
};

export const initSocketIO = async (httpServer: HttpServer): Promise<Server> => {
  const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  try {
    const ready = await ensureRedisReady();
    if (ready) {
      const pubClient = getRedisClient();
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter enabled');
    }
  } catch (err) {
    logger.warn(
      `Socket.io Redis adapter unavailable: ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }

  io.use(async (socket, next) => {
    try {
      const token = extractSocketToken(socket);
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const blacklisted = await isTokenBlacklisted(token);
      if (blacklisted) {
        return next(new Error('Token has been revoked'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.data.userId = user._id.toString();
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error(err instanceof Error ? err.message : 'Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;

    void handleConnect(socket, userId);

    socket.on('conversation:join', (data: { conversationId: string }) => {
      void handleJoinConversation(socket, userId, data.conversationId);
    });

    socket.on('conversation:leave', (data: { conversationId: string }) => {
      void handleLeaveConversation(socket, data.conversationId);
    });

    socket.on('typing:start', (data: { conversationId: string }) => {
      void handleTyping(socket, userId, data.conversationId, true);
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      void handleTyping(socket, userId, data.conversationId, false);
    });

    socket.on('disconnect', () => {
      void handleDisconnect(userId);
    });
  });

  logger.info('Socket.io initialized');
  return io;
};

const handleConnect = async (socket: Socket, userId: string): Promise<void> => {
  socket.join(`user:${userId}`);

  await User.findByIdAndUpdate(userId, {
    isOnline: true,
    lastSeenAt: new Date(),
  });

  if (io) {
    io.emit('presence:update', {
      userId,
      isOnline: true,
      lastSeenAt: new Date().toISOString(),
    });
  }

  logger.debug(`Socket connected: user ${userId}`);
};

const handleDisconnect = async (userId: string): Promise<void> => {
  const lastSeenAt = new Date();
  await User.findByIdAndUpdate(userId, {
    isOnline: false,
    lastSeenAt,
  });

  if (io) {
    io.emit('presence:update', {
      userId,
      isOnline: false,
      lastSeenAt: lastSeenAt.toISOString(),
    });
  }
};

const handleJoinConversation = async (
  socket: Socket,
  userId: string,
  conversationId: string
): Promise<void> => {
  try {
    await ensureParticipant(conversationId, userId);
    socket.join(`conversation:${conversationId}`);
  } catch (err) {
    logger.warn(
      `Join conversation failed for ${userId}: ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }
};

const handleLeaveConversation = async (
  socket: Socket,
  conversationId: string
): Promise<void> => {
  socket.leave(`conversation:${conversationId}`);
};

const handleTyping = async (
  socket: Socket,
  userId: string,
  conversationId: string,
  isTyping: boolean
): Promise<void> => {
  try {
    await ensureParticipant(conversationId, userId);

    const roomKey = conversationId;
    if (!typingUsers.has(roomKey)) {
      typingUsers.set(roomKey, new Map());
    }
    const roomTyping = typingUsers.get(roomKey)!;

    if (isTyping) {
      const existing = roomTyping.get(userId);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        roomTyping.delete(userId);
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          conversationId,
          userId,
          isTyping: false,
        });
      }, 5000);

      roomTyping.set(userId, timeout);
    } else {
      const existing = roomTyping.get(userId);
      if (existing) clearTimeout(existing);
      roomTyping.delete(userId);
    }

    socket.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId,
      isTyping,
    });
  } catch {
    // silently ignore unauthorized typing
  }
};

export const emitConversationCreated = (
  conversation: unknown,
  participantIds: string[]
): void => {
  for (const participantId of participantIds) {
    emitChatEvent('conversation:created', { conversation }, `user:${participantId}`);
  }
};
