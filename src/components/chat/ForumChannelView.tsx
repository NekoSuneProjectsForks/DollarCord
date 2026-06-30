"use client";

import { ThreadPanel } from "./ThreadPanel";
import type { Channel, User } from "@/types";

interface Props {
  channel: Channel;
  currentUser: User;
}

// Forum channels open straight to their thread list (posts). Reuses ThreadPanel
// as the full-width landing view.
export function ForumChannelView({ channel, currentUser }: Props) {
  return (
    <div className="flex flex-1 min-h-0 bg-dc-chat">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-dc-border shrink-0 w-full absolute top-0 left-0 pointer-events-none" />
      <ThreadPanel
        channelId={channel.id}
        serverId={channel.serverId}
        currentUser={currentUser}
        onClose={() => {}}
      />
      <div className="flex-1 hidden md:flex items-center justify-center text-dc-faint text-sm">
        <p>🗂 Select a post on the left, or start a new one.</p>
      </div>
    </div>
  );
}
