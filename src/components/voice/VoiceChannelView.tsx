"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceChannel } from "@/hooks/useVoiceChannel";
import { Avatar } from "@/components/ui/Avatar";
import { VoiceTextChat } from "./VoiceTextChat";
import type { Channel, MemberRole, User } from "@/types";

interface Props {
  channel: Channel;
  currentUser: User;
  currentUserRole: MemberRole;
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      {muted && <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" />}
    </svg>
  );
}

function HeadphonesIcon({ deafened }: { deafened: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 14a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Zm-18 0a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2Z" />
      {deafened && <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" />}
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function VideoTile({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
      <video ref={ref} autoPlay playsInline muted className="h-full w-full object-contain" />
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{label}</span>
    </div>
  );
}

export function VoiceChannelView({ channel, currentUser, currentUserRole }: Props) {
  const v = useVoiceChannel(channel.id);
  const [showChat, setShowChat] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const canModerate = ["OWNER", "ADMIN"].includes(currentUserRole);

  const videoEntries = Object.entries(v.remoteVideo);
  const hasVideo = videoEntries.length > 0 || v.screenSharing;

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0 bg-dc-chat">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-dc-border shrink-0">
          <span className="text-dc-muted text-lg">🔊</span>
          <span className="font-semibold text-dc-text">{channel.name}</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-dc-muted text-xs">{v.participants.length} in voice</span>
            <button
              onClick={() => setShowChat((s) => !s)}
              className="text-dc-muted hover:text-dc-text text-xs"
              title="Toggle chat"
            >
              {showChat ? "Hide chat" : "Show chat"}
            </button>
          </span>
        </div>

        {/* Stage */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {hasVideo && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {v.localScreenStream && <VideoTile stream={v.localScreenStream} label="You (screen)" />}
              {videoEntries.map(([socketId, stream]) => {
                const p = v.participants.find((x) => x.socketId === socketId);
                return <VideoTile key={socketId} stream={stream} label={`${p?.displayName ?? "Peer"} (screen)`} />;
              })}
            </div>
          )}

          {v.participants.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-3">🔊</div>
              <h2 className="text-dc-text text-lg font-semibold">{channel.name}</h2>
              <p className="text-dc-muted text-sm mt-1 max-w-sm">No one is here yet. Join to start talking.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {v.participants.map((p) => {
                const isSpeaking = v.speaking[p.socketId] && !p.muted;
                const isSelf = p.userId === currentUser.id;
                return (
                  <div key={p.socketId} className="relative flex flex-col items-center gap-3 rounded-xl bg-dc-overlay py-6 px-3">
                    {canModerate && !isSelf && (
                      <button
                        onClick={() => setMenuFor(menuFor === p.socketId ? null : p.socketId)}
                        className="absolute top-2 right-2 text-dc-muted hover:text-dc-text text-xs"
                        title="Moderate"
                      >
                        ⋯
                      </button>
                    )}
                    {menuFor === p.socketId && (
                      <div className="absolute top-7 right-2 z-10 w-36 rounded bg-dc-rail border border-dc-border shadow-xl text-sm">
                        <button
                          className="block w-full text-left px-3 py-2 text-dc-text hover:bg-dc-hover"
                          onClick={() => { v.moderate(p.socketId, { mute: !p.muted }, channel.serverId); setMenuFor(null); }}
                        >
                          {p.muted ? "Server unmute" : "Server mute"}
                        </button>
                        <button
                          className="block w-full text-left px-3 py-2 text-dc-text hover:bg-dc-hover"
                          onClick={() => { v.moderate(p.socketId, { deafen: !p.deafened }, channel.serverId); setMenuFor(null); }}
                        >
                          {p.deafened ? "Server undeafen" : "Server deafen"}
                        </button>
                      </div>
                    )}
                    <div className={`rounded-full transition-shadow ${isSpeaking ? "ring-4 ring-dc-success" : "ring-2 ring-transparent"}`}>
                      <Avatar user={p} size="lg" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-dc-text text-sm font-medium truncate max-w-[8rem]">{p.displayName}</span>
                      {p.muted && <span className="text-dc-danger" title="Muted"><MicIcon muted /></span>}
                      {p.deafened && <span className="text-dc-danger" title="Deafened"><HeadphonesIcon deafened /></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Control bar */}
        <div className="border-t border-dc-border bg-dc-overlay px-4 py-3 shrink-0">
          {v.error && <p className="text-dc-danger text-xs mb-2 text-center">{v.error}</p>}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!v.joined ? (
              <button
                onClick={v.join}
                disabled={v.connecting}
                className="px-6 py-2.5 rounded-full bg-dc-success hover:opacity-90 disabled:opacity-50 text-white font-semibold text-sm transition-opacity"
              >
                {v.connecting ? "Connecting…" : "Join Voice"}
              </button>
            ) : (
              <>
                {/* Mode toggle */}
                <div className="flex items-center rounded-full bg-dc-hover p-0.5 text-xs">
                  <button
                    onClick={() => v.setMode("vad")}
                    className={`px-3 py-1.5 rounded-full transition-colors ${v.mode === "vad" ? "bg-dc-accent text-white" : "text-dc-muted"}`}
                  >
                    Voice
                  </button>
                  <button
                    onClick={() => v.setMode("ptt")}
                    className={`px-3 py-1.5 rounded-full transition-colors ${v.mode === "ptt" ? "bg-dc-accent text-white" : "text-dc-muted"}`}
                    title="Push to talk (hold Space)"
                  >
                    PTT{v.mode === "ptt" && v.pttActive ? " ●" : ""}
                  </button>
                </div>

                <button
                  onClick={v.toggleMute}
                  disabled={v.forcedMute}
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                    v.muted ? "bg-dc-danger text-white" : "bg-dc-hover text-dc-text hover:bg-dc-border"
                  }`}
                  title={v.forcedMute ? "Server muted" : v.muted ? "Unmute" : "Mute"}
                >
                  <MicIcon muted={v.muted} />
                </button>
                <button
                  onClick={v.toggleDeafen}
                  disabled={v.forcedDeafen}
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                    v.deafened ? "bg-dc-danger text-white" : "bg-dc-hover text-dc-text hover:bg-dc-border"
                  }`}
                  title={v.forcedDeafen ? "Server deafened" : v.deafened ? "Undeafen" : "Deafen"}
                >
                  <HeadphonesIcon deafened={v.deafened} />
                </button>
                <button
                  onClick={v.toggleScreenShare}
                  className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                    v.screenSharing ? "bg-dc-accent text-white" : "bg-dc-hover text-dc-text hover:bg-dc-border"
                  }`}
                  title={v.screenSharing ? "Stop sharing" : "Share your screen"}
                >
                  <ScreenIcon />
                </button>
                <button
                  onClick={v.leave}
                  className="px-5 py-2.5 rounded-full bg-dc-danger hover:opacity-90 text-white font-semibold text-sm transition-opacity"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
          {v.joined && v.mode === "ptt" && (
            <p className="text-dc-faint text-[11px] text-center mt-2">Hold <kbd className="text-dc-muted">Space</kbd> to talk</p>
          )}
        </div>
      </div>

      {showChat && <VoiceTextChat channelId={channel.id} currentUser={currentUser} />}
    </div>
  );
}
