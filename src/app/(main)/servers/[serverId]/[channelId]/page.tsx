import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatArea } from "@/components/chat/ChatArea";

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

  const initialMessages = await prisma.message.findMany({
    where: { channelId: params.channelId, deleted: false },
    include: {
      user: true,
      bot: true,
      reactions: { include: { user: true } },
      replyTo: { include: { user: true, bot: true } },
    },
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
