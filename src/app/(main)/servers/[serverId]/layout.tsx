import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChannelSidebar } from "@/components/layout/ChannelSidebar";
import { MemberSidebar } from "@/components/layout/MemberSidebar";

interface Props {
  children: React.ReactNode;
  params: { serverId: string };
}

export default async function ServerLayout({ children, params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const server = await prisma.server.findUnique({
    where: { id: params.serverId },
    include: {
      channels: { orderBy: { position: "asc" } },
      members: {
        include: { user: true, roles: { include: { role: true } } },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
      events: {
        where: { canceled: false, startsAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
        include: {
          channel: true,
          participants: { where: { userId: user.id } },
          _count: { select: { participants: true } },
        },
        orderBy: { startsAt: "asc" },
        take: 10,
      },
    },
  });

  if (!server) notFound();

  // Verify membership
  const membership = server.members.find((m) => m.userId === user.id);
  if (!membership) notFound();

  const typedMembers = server.members.map((m) => ({
    ...m,
    role: m.role as "OWNER" | "ADMIN" | "MEMBER",
    roles: m.roles,
    user: {
      id: m.user.id,
      email: m.user.email,
      username: m.user.username,
      displayName: m.user.displayName,
      bio: m.user.bio,
      avatarUrl: m.user.avatarUrl,
      twitchChannel: m.user.twitchChannel,
      kickChannel: m.user.kickChannel,
      createdAt: m.user.createdAt,
    },
  }));

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChannelSidebar
        server={server}
        channels={server.channels}
        initialEvents={server.events.map((event) => ({
          ...event,
          currentUserParticipant: event.participants[0] ?? null,
          participantCount: event._count.participants,
        }))}
        currentUserId={user.id}
        currentUserRole={membership.role as "OWNER" | "ADMIN" | "MEMBER"}
      />
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
      <MemberSidebar
        members={typedMembers}
        serverId={server.id}
        currentUserId={user.id}
        currentUserRole={membership.role as "OWNER" | "ADMIN" | "MEMBER"}
      />
    </div>
  );
}
