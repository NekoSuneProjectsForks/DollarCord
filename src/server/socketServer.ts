import { Server as SocketServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { validateToken } from "../lib/auth";
import { startTwitchPoller } from "../lib/twitchPoller";

const SESSION_COOKIE = "dollarcord_session";

declare global {
  // eslint-disable-next-line no-var
  var __io: SocketServer | undefined;
}

const onlineUsers = new Map<string, number>();

/** Per-channel voice membership: channelId -> (socketId -> participant). */
interface VoiceParticipant {
  socketId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
}
const voiceRooms = new Map<string, Map<string, VoiceParticipant>>();

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }

  return undefined;
}

function markOnline(userId: string): boolean {
  const count = onlineUsers.get(userId) ?? 0;
  onlineUsers.set(userId, count + 1);
  return count === 0;
}

function markOffline(userId: string): boolean {
  const count = onlineUsers.get(userId) ?? 0;
  if (count <= 1) {
    onlineUsers.delete(userId);
    return true;
  }

  onlineUsers.set(userId, count - 1);
  return false;
}

function presenceSnapshot(): Record<string, boolean> {
  return Object.fromEntries(Array.from(onlineUsers.keys()).map((userId) => [userId, true]));
}

/** All current voice rooms as a plain object for snapshots. */
function voiceSnapshot(): Record<string, VoiceParticipant[]> {
  const out: Record<string, VoiceParticipant[]> = {};
  for (const [channelId, members] of Array.from(voiceRooms.entries())) {
    out[channelId] = Array.from(members.values());
  }
  return out;
}

function roomParticipants(channelId: string): VoiceParticipant[] {
  return Array.from(voiceRooms.get(channelId)?.values() ?? []);
}

/** Remove a socket from a voice channel; returns true if it was present. */
function leaveVoice(io: SocketServer, channelId: string, socketId: string): boolean {
  const members = voiceRooms.get(channelId);
  if (!members || !members.has(socketId)) return false;
  members.delete(socketId);
  if (members.size === 0) voiceRooms.delete(channelId);
  io.to(`voice:${channelId}`).emit("voice:participants", {
    channelId,
    participants: roomParticipants(channelId),
  });
  return true;
}

export function initSocketServer(httpServer: HTTPServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    const authToken = socket.handshake.auth?.token;
    const token =
      (typeof authToken === "string" && authToken) ||
      readCookie(socket.handshake.headers.cookie, SESSION_COOKIE);

    if (!token) return next(new Error("Authentication required"));

    const user = await validateToken(token);
    if (!user) return next(new Error("Invalid or expired session"));

    socket.data.userId = user.id;
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;

    socket.join(`user:${userId}`);
    socket.emit("presence:snapshot", presenceSnapshot());
    socket.emit("voice:snapshot", voiceSnapshot());

    if (markOnline(userId)) {
      socket.broadcast.emit("presence:update", { userId, online: true });
    }

    socket.on("channel:join", (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on("channel:leave", (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on("server:join", (serverId: string) => {
      socket.join(`server:${serverId}`);
    });

    socket.on("server:leave", (serverId: string) => {
      socket.leave(`server:${serverId}`);
    });

    socket.on("typing:start", ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit("typing:start", {
        channelId,
        userId,
        username: socket.data.user.username,
        displayName: socket.data.user.displayName,
      });
    });

    socket.on("typing:stop", ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit("typing:stop", {
        channelId,
        userId,
      });
    });

    socket.on("dm:typing:start", ({ threadId }: { threadId: string }) => {
      socket.to(`dm:${threadId}`).emit("dm:typing:start", {
        threadId,
        userId,
        username: socket.data.user.username,
        displayName: socket.data.user.displayName,
      });
    });

    socket.on("dm:typing:stop", ({ threadId }: { threadId: string }) => {
      socket.to(`dm:${threadId}`).emit("dm:typing:stop", { threadId, userId });
    });

    socket.on("dm:join", (threadId: string) => {
      socket.join(`dm:${threadId}`);
    });

    socket.on("dm:leave", (threadId: string) => {
      socket.leave(`dm:${threadId}`);
    });

    // ---- Activity / status -------------------------------------------------
    // Lets a client optimistically broadcast a status change. The DB is the
    // source of truth (updated via the API routes), but this keeps every open
    // tab in sync immediately.
    socket.on("presence:status", ({ status }: { status: string }) => {
      io.emit("presence:status", { userId, status });
    });

    // ---- Voice (WebRTC P2P mesh signaling) ---------------------------------
    socket.on(
      "voice:join",
      ({ channelId, muted = false, deafened = false }: { channelId: string; muted?: boolean; deafened?: boolean }) => {
        // A socket may only be in one voice channel at a time.
        for (const existing of Array.from(voiceRooms.keys())) {
          if (existing !== channelId) leaveVoice(io, existing, socket.id);
        }

        socket.join(`voice:${channelId}`);
        if (!voiceRooms.has(channelId)) voiceRooms.set(channelId, new Map());

        const participant: VoiceParticipant = {
          socketId: socket.id,
          userId,
          username: socket.data.user.username,
          displayName: socket.data.user.displayName,
          avatarUrl: socket.data.user.avatarUrl ?? null,
          muted,
          deafened,
        };
        voiceRooms.get(channelId)!.set(socket.id, participant);

        // Send the joining socket the list of existing peers it should call.
        const peers = roomParticipants(channelId).filter((p) => p.socketId !== socket.id);
        socket.emit("voice:peers", { channelId, peers });

        // Tell everyone (incl. joiner) the refreshed participant list.
        io.to(`voice:${channelId}`).emit("voice:participants", {
          channelId,
          participants: roomParticipants(channelId),
        });
        // Broadcast lightweight roster change for sidebars across the server.
        socket.broadcast.emit("voice:participants", {
          channelId,
          participants: roomParticipants(channelId),
        });
      }
    );

    socket.on("voice:leave", ({ channelId }: { channelId: string }) => {
      socket.leave(`voice:${channelId}`);
      if (leaveVoice(io, channelId, socket.id)) {
        socket.to(`voice:${channelId}`).emit("voice:peer:left", { channelId, socketId: socket.id });
        socket.broadcast.emit("voice:participants", {
          channelId,
          participants: roomParticipants(channelId),
        });
      }
    });

    // Relay an SDP offer/answer or ICE candidate to a specific peer socket.
    socket.on(
      "voice:signal",
      ({ to, data }: { to: string; data: unknown }) => {
        io.to(to).emit("voice:signal", { from: socket.id, data });
      }
    );

    socket.on(
      "voice:state",
      ({ channelId, muted, deafened }: { channelId: string; muted: boolean; deafened: boolean }) => {
        const members = voiceRooms.get(channelId);
        const participant = members?.get(socket.id);
        if (!participant) return;
        participant.muted = muted;
        participant.deafened = deafened;
        io.to(`voice:${channelId}`).emit("voice:participants", {
          channelId,
          participants: roomParticipants(channelId),
        });
        io.to(`voice:${channelId}`).emit("voice:speaking:state", {
          channelId,
          socketId: socket.id,
          muted,
          deafened,
        });
      }
    );

    // Real-time speaking indicator (volume gate computed client-side).
    socket.on("voice:speaking", ({ channelId, speaking }: { channelId: string; speaking: boolean }) => {
      socket.to(`voice:${channelId}`).emit("voice:speaking", {
        channelId,
        socketId: socket.id,
        userId,
        speaking,
      });
    });

    socket.on("disconnect", () => {
      // Remove from any voice rooms this socket was in.
      for (const [channelId, members] of Array.from(voiceRooms.entries())) {
        if (members.has(socket.id)) {
          leaveVoice(io, channelId, socket.id);
          socket.to(`voice:${channelId}`).emit("voice:peer:left", { channelId, socketId: socket.id });
          socket.broadcast.emit("voice:participants", {
            channelId,
            participants: roomParticipants(channelId),
          });
        }
      }

      if (markOffline(userId)) {
        socket.broadcast.emit("presence:update", { userId, online: false });
      }
    });
  });

  globalThis.__io = io;
  startTwitchPoller();
  return io;
}

export function getIO(): SocketServer {
  if (!globalThis.__io) throw new Error("Socket.IO server not initialized");
  return globalThis.__io;
}

/** Best-effort accessor for API routes that emit only when the socket layer is up. */
export function tryGetIO(): SocketServer | null {
  return globalThis.__io ?? null;
}
