"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/contexts/SocketContext";
import type { VoiceParticipant } from "@/types";

// WebRTC peer-to-peer mesh voice/video with screen share. Uses the "perfect
// negotiation" pattern so the initial audio connection and later track changes
// (camera / screen on-off) renegotiate cleanly. The `roomId` is any string — a
// channel id for voice channels, or a DM thread id for direct calls.

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

export interface RemoteVideo {
  socketId: string;
  stream: MediaStream;
}

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface VoiceConnection {
  joined: boolean;
  connecting: boolean;
  muted: boolean;
  deafened: boolean;
  forcedMute: boolean;
  forcedDeafen: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  mode: VoiceMode;
  pttKey: string;
  pttActive: boolean;
  error: string | null;
  participants: VoiceParticipant[];
  speaking: Record<string, boolean>;
  localScreenStream: MediaStream | null;
  localCameraStream: MediaStream | null;
  remoteVideo: Record<string, RemoteVideo>;
  volumes: Record<string, number>;
  inputs: MediaDeviceOption[];
  outputs: MediaDeviceOption[];
  selectedInput: string;
  selectedOutput: string;
  vadThreshold: number;
  join: () => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setMode: (mode: VoiceMode) => void;
  setPttKey: (key: string) => void;
  setVolume: (socketId: string, volume: number) => void;
  selectInput: (deviceId: string) => Promise<void>;
  selectOutput: (deviceId: string) => void;
  setVadThreshold: (v: number) => void;
  moderate: (targetSocketId: string, action: { mute?: boolean; deafen?: boolean }, channelServerId: string) => void;
}

export function useVoiceChannel(roomId: string): VoiceConnection {
  const { socket, voiceRooms } = useSocket();
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [forcedMute, setForcedMute] = useState(false);
  const [forcedDeafen, setForcedDeafen] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mode, setModeState] = useState<VoiceMode>("vad");
  const [pttKey, setPttKey] = useState("Space");
  const [pttActive, setPttActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [remoteVideo, setRemoteVideo] = useState<Record<string, RemoteVideo>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [inputs, setInputs] = useState<MediaDeviceOption[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceOption[]>([]);
  const [selectedInput, setSelectedInput] = useState("");
  const [selectedOutput, setSelectedOutput] = useState("");
  const [vadThreshold, setVadThresholdState] = useState(12);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const joinedRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const modeRef = useRef<VoiceMode>("vad");
  const pttKeyRef = useRef("Space");
  const pttActiveRef = useRef(false);
  const vadRef = useRef(12);
  const volumesRef = useRef<Record<string, number>>({});
  const outputRef = useRef("");

  const participants = voiceRooms[roomId] ?? [];

  const applyMicEnabled = useCallback(() => {
    const enabled = !mutedRef.current && (modeRef.current === "vad" || pttActiveRef.current);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }, []);

  const setMode = useCallback((m: VoiceMode) => {
    modeRef.current = m;
    setModeState(m);
    applyMicEnabled();
  }, [applyMicEnabled]);

  const setVadThreshold = useCallback((v: number) => {
    vadRef.current = v;
    setVadThresholdState(v);
  }, []);

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
      cameraStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, cameraStreamRef.current!));

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
          el.volume = volumesRef.current[peerSocketId] ?? 1;
          if (outputRef.current && (el as any).setSinkId) (el as any).setSinkId(outputRef.current).catch(() => {});
          el.play().catch(() => {});
        } else if (e.track.kind === "video") {
          const key = stream.id;
          setRemoteVideo((prev) => ({ ...prev, [key]: { socketId: peerSocketId, stream } }));
          e.track.onended = () => setRemoteVideo((prev) => {
            const next = { ...prev };
            delete next[key];
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
    if (el) { el.srcObject = null; audioElsRef.current.delete(peerSocketId); }
    setSpeaking((prev) => { const n = { ...prev }; delete n[peerSocketId]; return n; });
    setRemoteVideo((prev) => {
      const n = { ...prev };
      for (const k of Object.keys(n)) if (n[k].socketId === peerSocketId) delete n[k];
      return n;
    });
  }, []);

  // --- signaling + control listeners ----------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onPeers = ({ channelId, peers }: { channelId: string; peers: VoiceParticipant[] }) => {
      if (channelId !== roomId || !joinedRef.current) return;
      for (const peer of peers) getPeer(peer.socketId);
    };

    const onSignal = async ({ from, data }: { from: string; data: any }) => {
      if (!joinedRef.current) return;
      const state = getPeer(from);
      const { pc } = state;
      try {
        if (data.description) {
          const offerCollision = data.description.type === "offer" && (state.makingOffer || pc.signalingState !== "stable");
          state.ignoreOffer = !state.polite && offerCollision;
          if (state.ignoreOffer) return;
          await pc.setRemoteDescription(data.description);
          if (data.description.type === "offer") {
            await pc.setLocalDescription(await pc.createAnswer());
            socket.emit("voice:signal", { to: from, data: { description: pc.localDescription } });
          }
        } else if (data.candidate) {
          try { await pc.addIceCandidate(data.candidate); } catch (err) { if (!state.ignoreOffer) throw err; }
        }
      } catch (err) {
        console.error("[voice] signal handling failed", err);
      }
    };

    const onPeerLeft = ({ channelId, socketId }: { channelId: string; socketId: string }) => {
      if (channelId !== roomId) return;
      closePeer(socketId);
    };

    const onSpeaking = ({ channelId, socketId, speaking: spk }: { channelId: string; socketId: string; speaking: boolean }) => {
      if (channelId !== roomId) return;
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
          deafenedRef.current = true; setDeafened(true);
          audioElsRef.current.forEach((el) => (el.muted = true));
          mutedRef.current = true; setMuted(true); applyMicEnabled();
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
  }, [socket, roomId, getPeer, closePeer, applyMicEnabled]);

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
        const isSpeaking = micLive && avg > vadRef.current;
        if (isSpeaking !== lastSpeaking) {
          lastSpeaking = isSpeaking;
          socket?.emit("voice:speaking", { channelId: roomId, speaking: isSpeaking });
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => { cancelAnimationFrame(raf); ctx.close().catch(() => {}); };
    },
    [socket, roomId]
  );

  // --- push-to-talk ---------------------------------------------------------
  useEffect(() => {
    const matches = (e: KeyboardEvent) => e.code === pttKeyRef.current || e.key === pttKeyRef.current;
    const down = (e: KeyboardEvent) => {
      if (!joinedRef.current || modeRef.current !== "ptt" || !matches(e) || pttActiveRef.current) return;
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      e.preventDefault();
      pttActiveRef.current = true; setPttActive(true); applyMicEnabled();
    };
    const up = (e: KeyboardEvent) => {
      if (modeRef.current !== "ptt" || !matches(e)) return;
      pttActiveRef.current = false; setPttActive(false); applyMicEnabled();
      socket?.emit("voice:speaking", { channelId: roomId, speaking: false });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [socket, roomId, applyMicEnabled]);

  useEffect(() => { pttKeyRef.current = pttKey; }, [pttKey]);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputs(devices.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" })));
      setOutputs(devices.filter((d) => d.kind === "audiooutput").map((d) => ({ deviceId: d.deviceId, label: d.label || "Speaker" })));
    } catch { /* permissions not granted yet */ }
  }, []);

  // --- public actions -------------------------------------------------------
  const join = useCallback(async () => {
    if (joinedRef.current || connecting || !socket) return;
    setConnecting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, noiseSuppression: true, autoGainControl: true,
          ...(selectedInput ? { deviceId: { exact: selectedInput } } : {}),
        },
        video: false,
      });
      localStreamRef.current = stream;
      joinedRef.current = true;
      setJoined(true);
      applyMicEnabled();
      stopVadRef.current = startVad(stream);
      socket.emit("voice:join", { channelId: roomId, muted: mutedRef.current, deafened: deafenedRef.current });
      refreshDevices();
    } catch (err) {
      console.error("[voice] getUserMedia failed", err);
      setError("Microphone access was denied or unavailable.");
    } finally {
      setConnecting(false);
    }
  }, [socket, connecting, roomId, startVad, applyMicEnabled, selectedInput, refreshDevices]);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    socket?.emit("voice:leave", { channelId: roomId });
    peersRef.current.forEach((s) => s.pc.close());
    peersRef.current.clear();
    audioElsRef.current.forEach((el) => (el.srcObject = null));
    audioElsRef.current.clear();
    [localStreamRef, screenStreamRef, cameraStreamRef].forEach((ref) => {
      ref.current?.getTracks().forEach((t) => t.stop());
      ref.current = null;
    });
    stopVadRef.current?.();
    stopVadRef.current = null;
    joinedRef.current = false;
    setJoined(false);
    setScreenSharing(false);
    setCameraOn(false);
    setLocalScreenStream(null);
    setLocalCameraStream(null);
    setSpeaking({});
    setRemoteVideo({});
  }, [socket, roomId]);

  const toggleMute = useCallback(() => {
    if (forcedMute) return;
    const next = !mutedRef.current;
    mutedRef.current = next; setMuted(next); applyMicEnabled();
    socket?.emit("voice:state", { channelId: roomId, muted: next, deafened: deafenedRef.current });
    if (next) socket?.emit("voice:speaking", { channelId: roomId, speaking: false });
  }, [socket, roomId, forcedMute, applyMicEnabled]);

  const toggleDeafen = useCallback(() => {
    if (forcedDeafen) return;
    const next = !deafenedRef.current;
    deafenedRef.current = next; setDeafened(next);
    audioElsRef.current.forEach((el) => (el.muted = next));
    if (next && !mutedRef.current) { mutedRef.current = true; setMuted(true); applyMicEnabled(); }
    socket?.emit("voice:state", { channelId: roomId, muted: mutedRef.current, deafened: next });
  }, [socket, roomId, forcedDeafen, applyMicEnabled]);

  const toggleCamera = useCallback(async () => {
    if (!joinedRef.current) return;
    if (cameraStreamRef.current) {
      const tracks = cameraStreamRef.current.getTracks();
      peersRef.current.forEach(({ pc }) => {
        pc.getSenders().filter((s) => s.track && tracks.includes(s.track)).forEach((s) => pc.removeTrack(s));
      });
      tracks.forEach((t) => t.stop());
      cameraStreamRef.current = null;
      setCameraOn(false);
      setLocalCameraStream(null);
      return;
    }
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      cameraStreamRef.current = cam;
      setLocalCameraStream(cam);
      setCameraOn(true);
      const track = cam.getVideoTracks()[0];
      track.onended = () => { void toggleCamera(); };
      peersRef.current.forEach(({ pc }) => pc.addTrack(track, cam));
    } catch (err) {
      console.error("[voice] camera failed", err);
      setError("Camera access was denied or unavailable.");
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!joinedRef.current) return;
    if (screenStreamRef.current) {
      const tracks = screenStreamRef.current.getTracks();
      peersRef.current.forEach(({ pc }) => {
        pc.getSenders().filter((s) => s.track && tracks.includes(s.track)).forEach((s) => pc.removeTrack(s));
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
      videoTrack.onended = () => { void toggleScreenShare(); };
      peersRef.current.forEach(({ pc }) => pc.addTrack(videoTrack, display));
    } catch (err) {
      console.error("[voice] screen share failed", err);
    }
  }, []);

  const setVolume = useCallback((socketId: string, volume: number) => {
    volumesRef.current = { ...volumesRef.current, [socketId]: volume };
    setVolumes((prev) => ({ ...prev, [socketId]: volume }));
    const el = audioElsRef.current.get(socketId);
    if (el) el.volume = volume;
  }, []);

  const selectInput = useCallback(async (deviceId: string) => {
    setSelectedInput(deviceId);
    if (!joinedRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, deviceId: { exact: deviceId } },
      });
      const newTrack = stream.getAudioTracks()[0];
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
        sender?.replaceTrack(newTrack).catch(() => {});
      });
      localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
      localStreamRef.current = stream;
      applyMicEnabled();
      stopVadRef.current?.();
      stopVadRef.current = startVad(stream);
    } catch (err) {
      console.error("[voice] device switch failed", err);
    }
  }, [applyMicEnabled, startVad]);

  const selectOutput = useCallback((deviceId: string) => {
    outputRef.current = deviceId;
    setSelectedOutput(deviceId);
    audioElsRef.current.forEach((el) => { if ((el as any).setSinkId) (el as any).setSinkId(deviceId).catch(() => {}); });
  }, []);

  const moderate = useCallback(
    (targetSocketId: string, action: { mute?: boolean; deafen?: boolean }, channelServerId: string) => {
      socket?.emit("voice:moderate", { channelId: roomId, serverId: channelServerId, targetSocketId, ...action });
    },
    [socket, roomId]
  );

  useEffect(() => () => { if (joinedRef.current) leave(); }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    joined, connecting, muted, deafened, forcedMute, forcedDeafen, cameraOn, screenSharing, mode, pttKey, pttActive,
    error, participants, speaking, localScreenStream, localCameraStream, remoteVideo, volumes,
    inputs, outputs, selectedInput, selectedOutput, vadThreshold,
    join, leave, toggleMute, toggleDeafen, toggleCamera, toggleScreenShare, setMode, setPttKey,
    setVolume, selectInput, selectOutput, setVadThreshold, moderate,
  };
}
