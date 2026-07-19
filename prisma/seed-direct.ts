import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const config = await prisma.businessConfig.create({
    data: {
      businessName: "Your Service Business",
      businessPhone: "+15555551234",
      ownerPhone: "+1234567890",
      ownerEmail: "owner@yourbusiness.com",
      missedCallMessage: "Sorry we missed your call! {BUSINESS_NAME} will call you back shortly. Reply here if you'd like to send details now.",
      leadSubmissionMsg: "Hi {NAME}! Thanks for reaching out to {BUSINESS_NAME}. We got your message and will reply shortly.",
    },
  });
  console.log('Created config:', config);
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
