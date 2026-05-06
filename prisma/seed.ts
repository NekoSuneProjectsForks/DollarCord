import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing local development data...");

  await prisma.reaction.deleteMany();
  await prisma.pinnedMessage.deleteMany();
  await prisma.message.deleteMany();
  await prisma.directMessage.deleteMany();
  await prisma.directMessageParticipant.deleteMany();
  await prisma.directMessageThread.deleteMany();
  await prisma.serverEventParticipant.deleteMany();
  await prisma.serverEvent.deleteMany();
  await prisma.serverUserSettings.deleteMany();
  await prisma.bot.deleteMany();
  await prisma.serverBan.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.serverMemberRole.deleteMany();
  await prisma.serverRole.deleteMany();
  await prisma.serverMember.deleteMany();
  await prisma.server.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log("Database is now empty.");
  console.log("Register the first account to become the DollarCord platform admin.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
