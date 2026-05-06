import type { ServerEventParticipant } from "@/types";

export function serializeEventForUser<T extends {
  participants?: ServerEventParticipant[];
  _count?: { participants?: number };
}>(event: T, userId: string) {
  const participants = event.participants ?? [];
  return {
    ...event,
    currentUserParticipant: participants.find((participant) => participant.userId === userId) ?? null,
    participantCount: event._count?.participants ?? participants.length,
  };
}
