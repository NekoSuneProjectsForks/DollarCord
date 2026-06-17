"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import type { PresenceMap, StatusMap, ActivityMap, VoiceRoomMap, Activity, UserPresence } from "@/types";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  presence: PresenceMap;
  statuses: StatusMap;
  activities: ActivityMap;
  voiceRooms: VoiceRoomMap;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  presence: {},
  statuses: {},
  activities: {},
  voiceRooms: {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceMap>({});
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [activities, setActivities] = useState<ActivityMap>({});
  const [voiceRooms, setVoiceRooms] = useState<VoiceRoomMap>({});

  useEffect(() => {
    if (!user) {
      setPresence({});
      setStatuses({});
      setActivities({});
      setVoiceRooms({});
      return;
    }

    const s = io(window.location.origin, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("presence:snapshot", (snapshot: PresenceMap) => setPresence(snapshot));
    s.on("presence:update", ({ userId, online }: { userId: string; online: boolean }) => {
      setPresence((prev) => ({ ...prev, [userId]: online }));
    });

    s.on("presence:status", ({ userId, status, customStatus, customStatusEmoji }: { userId: string; status: string } & Partial<UserPresence>) => {
      setStatuses((prev) => ({
        ...prev,
        [userId]: {
          status: (status as UserPresence["status"]) ?? prev[userId]?.status ?? "ONLINE",
          customStatus: customStatus ?? prev[userId]?.customStatus ?? null,
          customStatusEmoji: customStatusEmoji ?? prev[userId]?.customStatusEmoji ?? null,
        },
      }));
    });

    s.on("presence:activity", ({ userId, activities: acts }: { userId: string; activities: Activity[] }) => {
      setActivities((prev) => ({ ...prev, [userId]: acts }));
    });

    s.on("voice:snapshot", (snapshot: VoiceRoomMap) => setVoiceRooms(snapshot));
    s.on("voice:participants", ({ channelId, participants }: { channelId: string; participants: VoiceRoomMap[string] }) => {
      setVoiceRooms((prev) => {
        const next = { ...prev };
        if (participants.length === 0) delete next[channelId];
        else next[channelId] = participants;
        return next;
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket, connected, presence, statuses, activities, voiceRooms }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
