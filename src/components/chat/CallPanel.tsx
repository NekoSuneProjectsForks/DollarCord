"use client";

import { useEffect, useRef } from "react";
import { useVoiceChannel } from "@/hooks/useVoiceChannel";
import { Avatar } from "@/components/ui/Avatar";
import type { User } from "@/types";

interface Props {
  threadId: string;
  currentUser: User;
  startWithVideo?: boolean;
  onClose: () => void;
}

function VideoTile({ stream, label, mirror }: { stream: MediaStream; label: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
      <video ref={ref} autoPlay playsInline muted className={`h-full w-full object-contain ${mirror ? "scale-x-[-1]" : ""}`} />
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{label}</span>
    </div>
  );
}

// Direct (DM) call panel — reuses the WebRTC voice engine with the thread id as
// the room. Auto-joins on mount; supports mic / camera / screen / leave.
export function CallPanel({ threadId, currentUser, startWithVideo, onClose }: Props) {
  const v = useVoiceChannel(threadId);
  const joinedOnce = useRef(false);

  useEffect(() => {
    if (joinedOnce.current) return;
    joinedOnce.current = true;
    (async () => {
      await v.join();
      if (startWithVideo) await v.toggleCamera();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const videoEntries = Object.entries(v.remoteVideo);

  function hangUp() {
    v.leave();
    onClose();
  }

  return (
    <div className="border-b border-dc-border bg-dc-overlay">
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {v.localCameraStream && <VideoTile stream={v.localCameraStream} label="You" mirror />}
          {v.localScreenStream && <VideoTile stream={v.localScreenStream} label="You (screen)" />}
          {videoEntries.map(([id, rv]) => {
            const p = v.participants.find((x) => x.socketId === rv.socketId);
            return <VideoTile key={id} stream={rv.stream} label={p?.displayName ?? "Peer"} />;
          })}
          {videoEntries.length === 0 && !v.localCameraStream && !v.localScreenStream && (
            <div className="col-span-full flex items-center justify-center gap-3 py-4">
              {v.participants.map((p) => (
                <div key={p.socketId} className="flex flex-col items-center gap-1">
                  <div className={`rounded-full ${v.speaking[p.socketId] && !p.muted ? "ring-2 ring-dc-success" : ""}`}>
                    <Avatar user={p} size="md" />
                  </div>
                  <span className="text-xs text-dc-muted">{p.displayName}</span>
                </div>
              ))}
              {v.participants.length <= 1 && <span className="text-dc-muted text-sm">Ringing… waiting for others to join.</span>}
            </div>
          )}
        </div>

        {v.error && <p className="text-dc-danger text-xs mb-2 text-center">{v.error}</p>}

        <div className="flex items-center justify-center gap-2">
          <button onClick={v.toggleMute} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${v.muted ? "bg-dc-danger text-white" : "bg-dc-hover text-dc-text"}`}>{v.muted ? "Unmute" : "Mute"}</button>
          <button onClick={v.toggleCamera} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${v.cameraOn ? "bg-dc-accent text-white" : "bg-dc-hover text-dc-text"}`}>{v.cameraOn ? "Camera Off" : "Camera"}</button>
          <button onClick={v.toggleScreenShare} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${v.screenSharing ? "bg-dc-accent text-white" : "bg-dc-hover text-dc-text"}`}>{v.screenSharing ? "Stop Share" : "Share"}</button>
          <button onClick={hangUp} className="px-4 py-1.5 rounded-full bg-dc-danger text-white text-xs font-semibold">Leave Call</button>
        </div>
      </div>
    </div>
  );
}
