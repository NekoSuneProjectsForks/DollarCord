"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/SocketContext";
import type { VoiceParticipant } from "@/types";

// WebRTC peer-to-peer mesh voice. Each participant holds one RTCPeerConnection
// per other participant. The newcomer always initiates offers to the peers that
// were already in the room (delivered via "voice:peers"), which avoids offer
// glare — existing peers simply answer.

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

export interface VoiceConnection {
  joined: boolean;
  connecting: boolean;
  muted: boolean;
  deafened: boolean;
  error: string | null;
  participants: VoiceParticipant[];
  speaking: Record<string, boolean>; // socketId -> speaking
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

export function useVoiceChannel(channelId: string): VoiceConnection {
  const { socket, voiceRooms } = useSocket();
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const joinedRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);

  const participants = voiceRooms[channelId] ?? [];

  // --- peer connection lifecycle -------------------------------------------
  const createPeer = useCallback(
    (peerSocketId: string): RTCPeerConnection => {
      const existing = pcsRef.current.get(peerSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      pcsRef.current.set(peerSocketId, pc);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket?.emit("voice:signal", { to: peerSocketId, data: { candidate: e.candidate } });
        }
      };

      pc.ontrack = (e) => {
        let el = audioElsRef.current.get(peerSocketId);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
          audioElsRef.current.set(peerSocketId, el);
        }
        el.srcObject = e.streams[0];
        el.muted = deafenedRef.current;
        el.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          // Let the explicit peer:left / re-join paths handle cleanup.
        }
      };

      return pc;
    },
    [socket]
  );

  const closePeer = useCallback((peerSocketId: string) => {
    pcsRef.current.get(peerSocketId)?.close();
    pcsRef.current.delete(peerSocketId);
    const el = audioElsRef.current.get(peerSocketId);
    if (el) {
      el.srcObject = null;
      audioElsRef.current.delete(peerSocketId);
    }
    setSpeaking((prev) => {
      const next = { ...prev };
      delete next[peerSocketId];
      return next;
    });
  }, []);

  // --- signaling listeners --------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onPeers = async ({ channelId: ch, peers }: { channelId: string; peers: VoiceParticipant[] }) => {
      if (ch !== channelId || !joinedRef.current) return;
      // We are the newcomer: initiate an offer to each existing peer.
      for (const peer of peers) {
        const pc = createPeer(peer.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("voice:signal", { to: peer.socketId, data: { sdp: pc.localDescription } });
      }
    };

    const onSignal = async ({ from, data }: { from: string; data: any }) => {
      if (!joinedRef.current) return;
      const pc = createPeer(from);
      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("voice:signal", { to: from, data: { sdp: pc.localDescription } });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          /* candidate may arrive before remote description; ignore */
        }
      }
    };

    const onPeerLeft = ({ channelId: ch, socketId }: { channelId: string; socketId: string }) => {
      if (ch !== channelId) return;
      closePeer(socketId);
    };

    const onSpeaking = ({ channelId: ch, socketId, speaking: spk }: { channelId: string; socketId: string; speaking: boolean }) => {
      if (ch !== channelId) return;
      setSpeaking((prev) => ({ ...prev, [socketId]: spk }));
    };

    socket.on("voice:peers", onPeers);
    socket.on("voice:signal", onSignal);
    socket.on("voice:peer:left", onPeerLeft);
    socket.on("voice:speaking", onSpeaking);

    return () => {
      socket.off("voice:peers", onPeers);
      socket.off("voice:signal", onSignal);
      socket.off("voice:peer:left", onPeerLeft);
      socket.off("voice:speaking", onSpeaking);
    };
  }, [socket, channelId, createPeer, closePeer]);

  // --- local speaking (voice-activity) detection ----------------------------
  const startVad = useCallback(
    (stream: MediaStream) => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastSpeaking = false;
      let raf = 0;

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const isSpeaking = !mutedRef.current && avg > 12;
        if (isSpeaking !== lastSpeaking) {
          lastSpeaking = isSpeaking;
          socket?.emit("voice:speaking", { channelId, speaking: isSpeaking });
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        ctx.close().catch(() => {});
      };
    },
    [socket, channelId]
  );
  const stopVadRef = useRef<(() => void) | null>(null);

  // --- public actions -------------------------------------------------------
  const join = useCallback(async () => {
    if (joinedRef.current || connecting || !socket) return;
    setConnecting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      joinedRef.current = true;
      setJoined(true);
      stopVadRef.current = startVad(stream);
      socket.emit("voice:join", { channelId, muted: mutedRef.current, deafened: deafenedRef.current });
    } catch (err) {
      console.error("[voice] getUserMedia failed", err);
      setError("Microphone access was denied or unavailable.");
    } finally {
      setConnecting(false);
    }
  }, [socket, connecting, channelId, startVad]);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    socket?.emit("voice:leave", { channelId });
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    audioElsRef.current.forEach((el) => (el.srcObject = null));
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    stopVadRef.current?.();
    stopVadRef.current = null;
    joinedRef.current = false;
    setJoined(false);
    setSpeaking({});
  }, [socket, channelId]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    socket?.emit("voice:state", { channelId, muted: next, deafened: deafenedRef.current });
    if (next) socket?.emit("voice:speaking", { channelId, speaking: false });
  }, [socket, channelId]);

  const toggleDeafen = useCallback(() => {
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    audioElsRef.current.forEach((el) => (el.muted = next));
    // Deafening implies muting yourself too (Discord behavior).
    if (next && !mutedRef.current) {
      mutedRef.current = true;
      setMuted(true);
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    }
    socket?.emit("voice:state", { channelId, muted: mutedRef.current, deafened: next });
  }, [socket, channelId]);

  // Clean up on unmount / channel change.
  useEffect(() => {
    return () => {
      if (joinedRef.current) leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return {
    joined,
    connecting,
    muted,
    deafened,
    error,
    participants,
    speaking,
    join,
    leave,
    toggleMute,
    toggleDeafen,
  };
}
