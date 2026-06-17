"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/SocketContext";
import type { VoiceParticipant } from "@/types";

// WebRTC peer-to-peer mesh voice with screen share. Uses the "perfect
// negotiation" pattern so that both the initial audio connection and later
// track changes (adding/removing a screen-share video track) renegotiate
// cleanly without offer glare. Politeness is derived deterministically from the
// two socket ids so exactly one peer is polite.

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

interface PeerState {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
}

export type VoiceMode = "vad" | "ptt";

export interface VoiceConnection {
  joined: boolean;
  connecting: boolean;
  muted: boolean;
  deafened: boolean;
  forcedMute: boolean;
  forcedDeafen: boolean;
  mode: VoiceMode;
  pttKey: string;
  pttActive: boolean;
  screenSharing: boolean;
  error: string | null;
  participants: VoiceParticipant[];
  speaking: Record<string, boolean>;
  localScreenStream: MediaStream | null;
  remoteVideo: Record<string, MediaStream>;
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setMode: (mode: VoiceMode) => void;
  setPttKey: (key: string) => void;
  toggleScreenShare: () => Promise<void>;
  moderate: (targetSocketId: string, action: { mute?: boolean; deafen?: boolean }, channelServerId: string) => void;
}

export function useVoiceChannel(channelId: string): VoiceConnection {
  const { socket, voiceRooms } = useSocket();
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [forcedMute, setForcedMute] = useState(false);
  const [forcedDeafen, setForcedDeafen] = useState(false);
  const [mode, setModeState] = useState<VoiceMode>("vad");
  const [pttKey, setPttKey] = useState("Space");
  const [pttActive, setPttActive] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteVideo, setRemoteVideo] = useState<Record<string, MediaStream>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const joinedRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const modeRef = useRef<VoiceMode>("vad");
  const pttKeyRef = useRef("Space");
  const pttActiveRef = useRef(false);

  const participants = voiceRooms[channelId] ?? [];

  // Mic is live when: not muted, and (VAD mode OR PTT key held).
  const applyMicEnabled = useCallback(() => {
    const enabled = !mutedRef.current && (modeRef.current === "vad" || pttActiveRef.current);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }, []);

  const setMode = useCallback((m: VoiceMode) => {
    modeRef.current = m;
    setModeState(m);
    applyMicEnabled();
  }, [applyMicEnabled]);

  // --- peer connection lifecycle (perfect negotiation) ----------------------
  const getPeer = useCallback(
    (peerSocketId: string): PeerState => {
      const existing = peersRef.current.get(peerSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const mySocketId = socket?.id ?? "";
      const state: PeerState = { pc, makingOffer: false, ignoreOffer: false, polite: mySocketId > peerSocketId };
      peersRef.current.set(peerSocketId, state);

      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
      screenStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, screenStreamRef.current!));

      pc.onnegotiationneeded = async () => {
        try {
          state.makingOffer = true;
          await pc.setLocalDescription(await pc.createOffer());
          socket?.emit("voice:signal", { to: peerSocketId, data: { description: pc.localDescription } });
        } catch (err) {
          console.error("[voice] negotiation failed", err);
        } finally {
          state.makingOffer = false;
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) socket?.emit("voice:signal", { to: peerSocketId, data: { candidate: e.candidate } });
      };

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (e.track.kind === "audio") {
          let el = audioElsRef.current.get(peerSocketId);
          if (!el) {
            el = new Audio();
            el.autoplay = true;
            (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
            audioElsRef.current.set(peerSocketId, el);
          }
          el.srcObject = stream;
          el.muted = deafenedRef.current;
          el.play().catch(() => {});
        } else if (e.track.kind === "video") {
          setRemoteVideo((prev) => ({ ...prev, [peerSocketId]: stream }));
          e.track.onended = () => setRemoteVideo((prev) => {
            const next = { ...prev };
            delete next[peerSocketId];
            return next;
          });
        }
      };

      return state;
    },
    [socket]
  );

  const closePeer = useCallback((peerSocketId: string) => {
    peersRef.current.get(peerSocketId)?.pc.close();
    peersRef.current.delete(peerSocketId);
    const el = audioElsRef.current.get(peerSocketId);
    if (el) {
      el.srcObject = null;
      audioElsRef.current.delete(peerSocketId);
    }
    setSpeaking((prev) => { const n = { ...prev }; delete n[peerSocketId]; return n; });
    setRemoteVideo((prev) => { const n = { ...prev }; delete n[peerSocketId]; return n; });
  }, []);

  // --- signaling + control listeners ----------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onPeers = ({ channelId: ch, peers }: { channelId: string; peers: VoiceParticipant[] }) => {
      if (ch !== channelId || !joinedRef.current) return;
      // Create a peer connection to each existing participant. Adding our local
      // tracks fires onnegotiationneeded, which sends the initial offer.
      for (const peer of peers) getPeer(peer.socketId);
    };

    const onSignal = async ({ from, data }: { from: string; data: any }) => {
      if (!joinedRef.current) return;
      const state = getPeer(from);
      const { pc } = state;
      try {
        if (data.description) {
          const offerCollision =
            data.description.type === "offer" && (state.makingOffer || pc.signalingState !== "stable");
          state.ignoreOffer = !state.polite && offerCollision;
          if (state.ignoreOffer) return;

          await pc.setRemoteDescription(data.description);
          if (data.description.type === "offer") {
            await pc.setLocalDescription(await pc.createAnswer());
            socket.emit("voice:signal", { to: from, data: { description: pc.localDescription } });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (err) {
            if (!state.ignoreOffer) throw err;
          }
        }
      } catch (err) {
        console.error("[voice] signal handling failed", err);
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

    const onModerate = ({ mute, deafen }: { mute?: boolean; deafen?: boolean }) => {
      if (typeof mute === "boolean") {
        setForcedMute(mute);
        if (mute) { mutedRef.current = true; setMuted(true); }
        applyMicEnabled();
      }
      if (typeof deafen === "boolean") {
        setForcedDeafen(deafen);
        if (deafen) {
          deafenedRef.current = true;
          setDeafened(true);
          audioElsRef.current.forEach((el) => (el.muted = true));
          mutedRef.current = true;
          setMuted(true);
          applyMicEnabled();
        }
      }
    };

    socket.on("voice:peers", onPeers);
    socket.on("voice:signal", onSignal);
    socket.on("voice:peer:left", onPeerLeft);
    socket.on("voice:speaking", onSpeaking);
    socket.on("voice:moderate", onModerate);

    return () => {
      socket.off("voice:peers", onPeers);
      socket.off("voice:signal", onSignal);
      socket.off("voice:peer:left", onPeerLeft);
      socket.off("voice:speaking", onSpeaking);
      socket.off("voice:moderate", onModerate);
    };
  }, [socket, channelId, getPeer, closePeer, applyMicEnabled]);

  // --- voice-activity detection ---------------------------------------------
  const stopVadRef = useRef<(() => void) | null>(null);
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
        const micLive = !mutedRef.current && (modeRef.current === "vad" || pttActiveRef.current);
        const isSpeaking = micLive && avg > 12;
        if (isSpeaking !== lastSpeaking) {
          lastSpeaking = isSpeaking;
          socket?.emit("voice:speaking", { channelId, speaking: isSpeaking });
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); ctx.close().catch(() => {}); };
    },
    [socket, channelId]
  );

  // --- push-to-talk key handling --------------------------------------------
  useEffect(() => {
    const matches = (e: KeyboardEvent) => e.code === pttKeyRef.current || e.key === pttKeyRef.current;
    const down = (e: KeyboardEvent) => {
      if (!joinedRef.current || modeRef.current !== "ptt" || !matches(e)) return;
      if (pttActiveRef.current) return;
      // Don't hijack typing in inputs.
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      e.preventDefault();
      pttActiveRef.current = true;
      setPttActive(true);
      applyMicEnabled();
    };
    const up = (e: KeyboardEvent) => {
      if (modeRef.current !== "ptt" || !matches(e)) return;
      pttActiveRef.current = false;
      setPttActive(false);
      applyMicEnabled();
      socket?.emit("voice:speaking", { channelId, speaking: false });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [socket, channelId, applyMicEnabled]);

  useEffect(() => { pttKeyRef.current = pttKey; }, [pttKey]);

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
      applyMicEnabled();
      stopVadRef.current = startVad(stream);
      socket.emit("voice:join", { channelId, muted: mutedRef.current, deafened: deafenedRef.current });
    } catch (err) {
      console.error("[voice] getUserMedia failed", err);
      setError("Microphone access was denied or unavailable.");
    } finally {
      setConnecting(false);
    }
  }, [socket, connecting, channelId, startVad, applyMicEnabled]);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    socket?.emit("voice:leave", { channelId });
    peersRef.current.forEach((s) => s.pc.close());
    peersRef.current.clear();
    audioElsRef.current.forEach((el) => (el.srcObject = null));
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    stopVadRef.current?.();
    stopVadRef.current = null;
    joinedRef.current = false;
    setJoined(false);
    setScreenSharing(false);
    setLocalScreenStream(null);
    setSpeaking({});
    setRemoteVideo({});
  }, [socket, channelId]);

  const toggleMute = useCallback(() => {
    if (forcedMute) return; // server-muted; cannot self-unmute
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    applyMicEnabled();
    socket?.emit("voice:state", { channelId, muted: next, deafened: deafenedRef.current });
    if (next) socket?.emit("voice:speaking", { channelId, speaking: false });
  }, [socket, channelId, forcedMute, applyMicEnabled]);

  const toggleDeafen = useCallback(() => {
    if (forcedDeafen) return;
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    audioElsRef.current.forEach((el) => (el.muted = next));
    if (next && !mutedRef.current) {
      mutedRef.current = true;
      setMuted(true);
      applyMicEnabled();
    }
    socket?.emit("voice:state", { channelId, muted: mutedRef.current, deafened: next });
  }, [socket, channelId, forcedDeafen, applyMicEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!joinedRef.current) return;
    if (screenStreamRef.current) {
      // Stop sharing: remove video senders and renegotiate.
      const tracks = screenStreamRef.current.getTracks();
      peersRef.current.forEach(({ pc }) => {
        pc.getSenders()
          .filter((s) => s.track && tracks.includes(s.track))
          .forEach((s) => pc.removeTrack(s));
      });
      tracks.forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      setLocalScreenStream(null);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = display;
      setLocalScreenStream(display);
      setScreenSharing(true);
      const videoTrack = display.getVideoTracks()[0];
      videoTrack.onended = () => { void toggleScreenShare(); }; // stop via browser UI
      peersRef.current.forEach(({ pc }) => pc.addTrack(videoTrack, display));
    } catch (err) {
      console.error("[voice] screen share failed", err);
    }
  }, []);

  const moderate = useCallback(
    (targetSocketId: string, action: { mute?: boolean; deafen?: boolean }, channelServerId: string) => {
      socket?.emit("voice:moderate", { channelId, serverId: channelServerId, targetSocketId, ...action });
    },
    [socket, channelId]
  );

  useEffect(() => () => { if (joinedRef.current) leave(); }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    joined, connecting, muted, deafened, forcedMute, forcedDeafen, mode, pttKey, pttActive,
    screenSharing, error, participants, speaking, localScreenStream, remoteVideo,
    join, leave, toggleMute, toggleDeafen, setMode, setPttKey, toggleScreenShare, moderate,
  };
}
