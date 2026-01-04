/**
 * Script to manually verify a user's email address
 * Usage: bun scripts/verify-user-email.ts <email>
 *
 * This is useful for accounts created before email verification was implemented
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyUserEmail(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    if (user.emailVerified) {
      console.log(`✅ User ${email} is already verified`);
      process.exit(0);
    }

    // Update user to verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpires: null,
      },
    });

    console.log(`✅ Successfully verified email for ${email}`);
    console.log(`   User can now log in`);
  } catch (error) {
    console.error("❌ Error verifying user email:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error("❌ Please provide an email address");
  console.log("Usage: bun scripts/verify-user-email.ts <email>");
  process.exit(1);
}

verifyUserEmail(email);
