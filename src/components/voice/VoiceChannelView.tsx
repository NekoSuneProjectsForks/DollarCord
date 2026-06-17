"use client";

import { useVoiceChannel } from "@/hooks/useVoiceChannel";
import { Avatar } from "@/components/ui/Avatar";
import type { Channel, User } from "@/types";

interface Props {
  channel: Channel;
  currentUser: User;
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

export function VoiceChannelView({ channel, currentUser }: Props) {
  const { joined, connecting, muted, deafened, error, participants, speaking, join, leave, toggleMute, toggleDeafen } =
    useVoiceChannel(channel.id);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-dc-chat">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-dc-border shrink-0">
        <span className="text-dc-muted text-lg">🔊</span>
        <span className="font-semibold text-dc-text">{channel.name}</span>
        {channel.description && (
          <>
            <span className="text-dc-faint">|</span>
            <span className="text-dc-muted text-sm truncate">{channel.description}</span>
          </>
        )}
        <span className="ml-auto text-dc-muted text-xs">
          {participants.length} in voice
        </span>
      </div>

      {/* Stage */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {participants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-3">🔊</div>
            <h2 className="text-dc-text text-lg font-semibold">{channel.name}</h2>
            <p className="text-dc-muted text-sm mt-1 max-w-sm">
              No one is here yet. Join the voice channel to start talking.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {participants.map((p) => {
              const isSpeaking = speaking[p.socketId] && !p.muted;
              return (
                <div
                  key={p.socketId}
                  className="flex flex-col items-center gap-3 rounded-xl bg-dc-overlay py-6 px-3"
                >
                  <div
                    className={`rounded-full transition-shadow ${
                      isSpeaking ? "ring-4 ring-dc-success shadow-[0_0_0_3px_rgba(59,165,93,0.35)]" : "ring-2 ring-transparent"
                    }`}
                  >
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
        {error && <p className="text-dc-danger text-xs mb-2 text-center">{error}</p>}
        <div className="flex items-center justify-center gap-3">
          {!joined ? (
            <button
              onClick={join}
              disabled={connecting}
              className="px-6 py-2.5 rounded-full bg-dc-success hover:opacity-90 disabled:opacity-50 text-white font-semibold text-sm transition-opacity"
            >
              {connecting ? "Connecting…" : "Join Voice"}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                  muted ? "bg-dc-danger text-white" : "bg-dc-hover text-dc-text hover:bg-dc-border"
                }`}
                title={muted ? "Unmute" : "Mute"}
              >
                <MicIcon muted={muted} />
              </button>
              <button
                onClick={toggleDeafen}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                  deafened ? "bg-dc-danger text-white" : "bg-dc-hover text-dc-text hover:bg-dc-border"
                }`}
                title={deafened ? "Undeafen" : "Deafen"}
              >
                <HeadphonesIcon deafened={deafened} />
              </button>
              <button
                onClick={leave}
                className="px-5 py-2.5 rounded-full bg-dc-danger hover:opacity-90 text-white font-semibold text-sm transition-opacity"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
