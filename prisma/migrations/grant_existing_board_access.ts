/**
 * Migration script to grant existing organization members access to all boards in their organizations
 * Run this after deploying the BoardMember schema changes
 * 
 * Usage: 
 *   npx tsx prisma/migrations/grant_existing_board_access.ts
 *   or
 *   bun run prisma/migrations/grant_existing_board_access.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration: Granting board access to existing members...");

  // Get all organizations
  const organizations = await prisma.organization.findMany({
    include: {
      members: true,
      boards: true,
    },
  });

  let totalGrants = 0;

  for (const org of organizations) {
    console.log(`Processing organization: ${org.name} (${org.boards.length} boards, ${org.members.length} members)`);

    for (const board of org.boards) {
      for (const member of org.members) {
        // Check if board member already exists
        const existing = await prisma.boardMember.findUnique({
          where: {
            boardId_memberId: {
              boardId: board.id,
              memberId: member.id,
            },
          },
        });

        if (!existing) {
          // Grant access - org admins get board admin, others get member
          const role = member.role === "ADMIN" ? "ADMIN" : "MEMBER";
          
          await prisma.boardMember.create({
            data: {
              boardId: board.id,
              memberId: member.id,
              role,
            },
          });

          totalGrants++;
          console.log(`  ✓ Granted ${role} access to board "${board.name}" for member ${member.id}`);
        }
      }
    }
  }

  console.log(`\nMigration complete! Granted ${totalGrants} board access records.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


