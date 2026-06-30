import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatArea } from "@/components/chat/ChatArea";
import { VoiceChannelView } from "@/components/voice/VoiceChannelView";
import { ForumChannelView } from "@/components/chat/ForumChannelView";
import { getChannelPermissions, has, Permission } from "@/lib/permissions";
import { resolvePlan } from "@/lib/plans";
import { MESSAGE_INCLUDE } from "@/lib/messages";

interface Props {
  params: { serverId: string; channelId: string };
}

export default async function ChannelPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const channel = await prisma.channel.findUnique({
    where: { id: params.channelId },
    include: { server: true },
  });

  if (!channel || channel.serverId !== params.serverId) notFound();

  // Verify membership
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId: params.serverId, userId: user.id } },
  });
  if (!member) notFound();

  const channelPerms = await getChannelPermissions(channel.id, params.serverId, user.id);
  if (!has(channelPerms, Permission.VIEW_CHANNEL)) notFound();

  if (channel.type === "VOICE") {
    const plan = resolvePlan(channel.server.plan);
    return (
      <VoiceChannelView
        channel={channel as any}
        currentUser={user}
        currentUserRole={member.role as "OWNER" | "ADMIN" | "MEMBER"}
        voiceBitrateKbps={plan.voiceBitrateKbps}
      />
    );
  }

  if (channel.type === "FORUM") {
    return <ForumChannelView channel={channel as any} currentUser={user} />;
  }

  const initialMessages = await prisma.message.findMany({
    where: { channelId: params.channelId, deleted: false, threadId: null },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const pinnedMessages = await prisma.pinnedMessage.findMany({
    where: { channelId: params.channelId },
    include: { message: { include: { user: true, bot: true } } },
  });

  return (
    <ChatArea
      channel={channel}
      currentUser={user}
      currentUserRole={member.role as "OWNER" | "ADMIN" | "MEMBER"}
      initialMessages={initialMessages.reverse() as any}
      pinnedMessages={pinnedMessages.map((p) => p.message) as any}
    />
  );
}
