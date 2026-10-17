const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── Create Demo Users ──────────────────────────────────────────────────────

  const password = await bcrypt.hash('password123', SALT_ROUNDS);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@newtonite.com' },
    update: {},
    create: {
      email: 'alice@newtonite.com',
      passwordHash: password,
      displayName: 'Alice Johnson',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@newtonite.com' },
    update: {},
    create: {
      email: 'bob@newtonite.com',
      passwordHash: password,
      displayName: 'Bob Smith',
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: 'carol@newtonite.com' },
    update: {},
    create: {
      email: 'carol@newtonite.com',
      passwordHash: password,
      displayName: 'Carol Williams',
    },
  });

  const dave = await prisma.user.upsert({
    where: { email: 'dave@newtonite.com' },
    update: {},
    create: {
      email: 'dave@newtonite.com',
      passwordHash: password,
      displayName: 'Dave Brown',
    },
  });

  const eve = await prisma.user.upsert({
    where: { email: 'eve@newtonite.com' },
    update: {},
    create: {
      email: 'eve@newtonite.com',
      passwordHash: password,
      displayName: 'Eve Davis',
    },
  });

  console.log('✅ Created 5 demo users');
  console.log('   Credentials: <any-email>@newtonite.com / password123\n');

  // ─── Create Teams ──────────────────────────────────────────────────────────

  const opsTeam = await prisma.team.upsert({
    where: { name: 'Operations' },
    update: {},
    create: {
      name: 'Operations',
      description: 'Main operations team handling critical incidents',
    },
  });

  const devTeam = await prisma.team.upsert({
    where: { name: 'Development' },
    update: {},
    create: {
      name: 'Development',
      description: 'Software development team',
    },
  });

  console.log('✅ Created 2 teams: Operations, Development\n');

  // ─── Assign Team Memberships ───────────────────────────────────────────────

  const memberships = [
    // Operations team
    { userId: alice.id, teamId: opsTeam.id, role: 'ADMIN' },
    { userId: bob.id, teamId: opsTeam.id, role: 'LEAD' },
    { userId: carol.id, teamId: opsTeam.id, role: 'MEMBER' },
    { userId: dave.id, teamId: opsTeam.id, role: 'MEMBER' },
    { userId: eve.id, teamId: opsTeam.id, role: 'VIEWER' },
    // Development team
    { userId: bob.id, teamId: devTeam.id, role: 'ADMIN' },
    { userId: carol.id, teamId: devTeam.id, role: 'LEAD' },
    { userId: dave.id, teamId: devTeam.id, role: 'MEMBER' },
  ];

  for (const m of memberships) {
    await prisma.teamMember.upsert({
      where: {
        userId_teamId: { userId: m.userId, teamId: m.teamId },
      },
      update: { role: m.role },
      create: m,
    });
  }

  console.log('✅ Assigned team memberships');
  console.log('   Operations: Alice(Admin), Bob(Lead), Carol(Member), Dave(Member), Eve(Viewer)');
  console.log('   Development: Bob(Admin), Carol(Lead), Dave(Member)\n');

  // ─── Create Sample Work Items ──────────────────────────────────────────────

  const workItems = [
    {
      title: 'Server CPU usage above 90%',
      description: 'Production server web-01 has sustained CPU usage above 90% for the past 30 minutes. Investigate and resolve.',
      status: 'OPEN',
      priority: 'CRITICAL',
      teamId: opsTeam.id,
      createdById: alice.id,
    },
    {
      title: 'Deploy v2.3.1 hotfix',
      description: 'Deploy the hotfix for the payment processing bug to production.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: opsTeam.id,
      createdById: bob.id,
      assignedToId: carol.id,
    },
    {
      title: 'Update SSL certificates',
      description: 'SSL certificates for *.newtonite.com expire in 7 days. Renew and deploy.',
      status: 'AWAITING_APPROVAL',
      priority: 'HIGH',
      teamId: opsTeam.id,
      createdById: carol.id,
      assignedToId: carol.id,
    },
    {
      title: 'Database backup verification',
      description: 'Verify that nightly database backups are completing successfully and test restore procedure.',
      status: 'RESOLVED',
      priority: 'MEDIUM',
      teamId: opsTeam.id,
      createdById: alice.id,
      assignedToId: dave.id,
    },
    {
      title: 'Review monitoring dashboards',
      description: 'Review and update Grafana dashboards for the new microservices.',
      status: 'OPEN',
      priority: 'LOW',
      teamId: opsTeam.id,
      createdById: bob.id,
    },
    {
      title: 'Implement user search API',
      description: 'Add full-text search endpoint for the user management module.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      teamId: devTeam.id,
      createdById: bob.id,
      assignedToId: dave.id,
    },
    {
      title: 'Fix pagination bug on dashboard',
      description: 'The dashboard shows duplicate entries when navigating between pages.',
      status: 'OPEN',
      priority: 'HIGH',
      teamId: devTeam.id,
      createdById: carol.id,
    },
  ];

  for (const wi of workItems) {
    const existing = await prisma.workItem.findFirst({
      where: { title: wi.title, teamId: wi.teamId },
    });

    if (!existing) {
      const created = await prisma.workItem.create({ data: wi });

      // Add creation activity
      await prisma.activity.create({
        data: {
          action: 'CREATED',
          workItemId: created.id,
          performedById: wi.createdById,
          newValue: JSON.stringify({
            title: wi.title,
            priority: wi.priority,
            status: wi.status,
          }),
        },
      });
    }
  }

  console.log('✅ Created 7 sample work items with activity logs\n');

  // ─── Add Sample Comments ───────────────────────────────────────────────────

  const firstItem = await prisma.workItem.findFirst({
    where: { title: 'Server CPU usage above 90%' },
  });

  if (firstItem) {
    const existingComments = await prisma.comment.count({
      where: { workItemId: firstItem.id },
    });

    if (existingComments === 0) {
      await prisma.comment.createMany({
        data: [
          {
            content: 'I checked the server and it seems the cron job for log rotation is stuck. Investigating further.',
            workItemId: firstItem.id,
            authorId: carol.id,
          },
          {
            content: 'Found the issue - the disk was 98% full causing the log rotation to fail. Cleaning up old logs now.',
            workItemId: firstItem.id,
            authorId: carol.id,
          },
          {
            content: 'Good catch Carol. Let\'s add a disk space alert to prevent this in the future.',
            workItemId: firstItem.id,
            authorId: bob.id,
          },
        ],
      });
      console.log('✅ Added sample comments\n');
    }
  }

  console.log('🎉 Seed completed successfully!\n');
  console.log('Demo login credentials:');
  console.log('┌────────────────────────────┬──────────────┐');
  console.log('│ Email                      │ Password     │');
  console.log('├────────────────────────────┼──────────────┤');
  console.log('│ alice@newtonite.com         │ password123  │');
  console.log('│ bob@newtonite.com           │ password123  │');
  console.log('│ carol@newtonite.com         │ password123  │');
  console.log('│ dave@newtonite.com          │ password123  │');
  console.log('│ eve@newtonite.com           │ password123  │');
  console.log('└────────────────────────────┴──────────────┘');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
