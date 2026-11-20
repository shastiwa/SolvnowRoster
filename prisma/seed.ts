import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Clean existing data in reverse dependency order
  await prisma.jobExecution.deleteMany();
  await prisma.syncHistory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.availabilityState.deleteMany();
  await prisma.availabilityOverride.deleteMany();
  await prisma.rosterEntry.deleteMany();
  await prisma.managerSupportGroup.deleteMany();
  await prisma.personSupportGroup.deleteMany();
  await prisma.person.deleteMany();
  await prisma.supportGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.applicationConfiguration.deleteMany();

  // 2. Default Configurations
  console.log("Creating default configuration...");
  await prisma.applicationConfiguration.createMany({
    data: [
      {
        key: "MISSING_ROSTER_POLICY",
        value: "TAKE_NO_ACTION",
        description:
          "Behavior when person has no roster entry: TAKE_NO_ACTION, KEEP_CURRENT_BMC_STATE, or SET_UNAVAILABLE",
        updatedBy: "system",
      },
      {
        key: "ON_CALL_AVAILABILITY_POLICY",
        value: "UNAVAILABLE",
        description:
          "Assignment availability during ON_CALL shifts: AVAILABLE or UNAVAILABLE",
        updatedBy: "system",
      },
      {
        key: "SYNC_INTERVAL_MINUTES",
        value: "15",
        description: "Interval in minutes for automatic availability reconciliation",
        updatedBy: "system",
      },
      {
        key: "DRY_RUN_DEFAULT",
        value: "false",
        description:
          "When true, availability sync runs in simulation mode without updating BMC Helix",
        updatedBy: "system",
      },
      {
        key: "BMC_PROVIDER_MODE",
        value: "mock",
        description: "BMC Helix provider mode: mock or helix",
        updatedBy: "system",
      },
      {
        key: "APP_TIMEZONE",
        value: "Asia/Kolkata",
        description: "Default application timezone for shift calculations",
        updatedBy: "system",
      },
    ],
  });

  // 3. Application Users
  console.log("Creating users...");
  const adminUser = await prisma.user.create({
    data: {
      loginName: "admin",
      displayName: "Global Administrator",
      email: "admin@solvnow.internal",
      role: "ROSTER_ADMIN",
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      loginName: "manager",
      displayName: "IT Operations Manager",
      email: "manager@solvnow.internal",
      role: "ROSTER_MANAGER",
    },
  });

  const standardUser = await prisma.user.create({
    data: {
      loginName: "arun.kumar",
      displayName: "Arun Kumar",
      email: "arun.kumar@solvnow.internal",
      role: "ROSTER_USER",
    },
  });

  // 4. Support Groups (from BMC Helix)
  console.log("Creating support groups...");
  const sgBackoffice = await prisma.supportGroup.create({
    data: {
      bmcSupportGroupId: "SGP000000001",
      name: "Backoffice Support",
      company: "Calbro Services",
      organization: "IT Operations",
      active: true,
    },
  });

  const sgServiceDesk = await prisma.supportGroup.create({
    data: {
      bmcSupportGroupId: "SGP000000002",
      name: "Service Desk Tier 1",
      company: "Calbro Services",
      organization: "Service Desk",
      active: true,
    },
  });

  const sgNOC = await prisma.supportGroup.create({
    data: {
      bmcSupportGroupId: "SGP000000003",
      name: "Network Operations Center",
      company: "Apex Global",
      organization: "Infrastructure",
      active: true,
    },
  });

  // 5. Manager Assignments
  console.log("Assigning manager to support groups...");
  await prisma.managerSupportGroup.createMany({
    data: [
      {
        managerUserId: managerUser.id,
        supportGroupId: sgBackoffice.id,
        active: true,
      },
      {
        managerUserId: managerUser.id,
        supportGroupId: sgServiceDesk.id,
        active: true,
      },
    ],
  });

  // 6. People (from BMC Helix)
  console.log("Creating people...");
  const personArun = await prisma.person.create({
    data: {
      bmcPersonId: "PPL000000001",
      loginId: "arunk",
      fullName: "Arun Kumar",
      email: "arun.kumar@solvnow.internal",
      active: true,
    },
  });

  const personPriya = await prisma.person.create({
    data: {
      bmcPersonId: "PPL000000002",
      loginId: "priyas",
      fullName: "Priya Sharma",
      email: "priya.sharma@solvnow.internal",
      active: true,
    },
  });

  const personRohan = await prisma.person.create({
    data: {
      bmcPersonId: "PPL000000003",
      loginId: "rohanm",
      fullName: "Rohan Mehta",
      email: "rohan.mehta@solvnow.internal",
      active: true,
    },
  });

  const personSneha = await prisma.person.create({
    data: {
      bmcPersonId: "PPL000000004",
      loginId: "snehap",
      fullName: "Sneha Patel",
      email: "sneha.patel@solvnow.internal",
      active: true,
    },
  });

  const personVikram = await prisma.person.create({
    data: {
      bmcPersonId: "PPL000000005",
      loginId: "vikrams",
      fullName: "Vikram Singh",
      email: "vikram.singh@solvnow.internal",
      active: true,
    },
  });

  // 7. Person - Support Group Memberships (with initial BMC availability)
  console.log("Creating group memberships...");
  await prisma.personSupportGroup.createMany({
    data: [
      // Arun is member in both Backoffice and Service Desk
      {
        personId: personArun.id,
        supportGroupId: sgBackoffice.id,
        currentBmcAvailability: true,
        defaultGroup: true,
        active: true,
      },
      {
        personId: personArun.id,
        supportGroupId: sgServiceDesk.id,
        currentBmcAvailability: false,
        defaultGroup: false,
        active: true,
      },
      // Priya is in Backoffice and NOC
      {
        personId: personPriya.id,
        supportGroupId: sgBackoffice.id,
        currentBmcAvailability: true,
        defaultGroup: true,
        active: true,
      },
      {
        personId: personPriya.id,
        supportGroupId: sgNOC.id,
        currentBmcAvailability: false,
        defaultGroup: false,
        active: true,
      },
      // Rohan is in Backoffice
      {
        personId: personRohan.id,
        supportGroupId: sgBackoffice.id,
        currentBmcAvailability: false,
        defaultGroup: true,
        active: true,
      },
      // Sneha is in Service Desk
      {
        personId: personSneha.id,
        supportGroupId: sgServiceDesk.id,
        currentBmcAvailability: true,
        defaultGroup: true,
        active: true,
      },
      // Vikram is in NOC
      {
        personId: personVikram.id,
        supportGroupId: sgNOC.id,
        currentBmcAvailability: true,
        defaultGroup: true,
        active: true,
      },
    ],
  });

  // 8. Roster Entries for Current Week
  console.log("Creating sample roster schedule for current week...");
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const getDayStr = (offset: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const currentWeekDates = [0, 1, 2, 3, 4, 5, 6].map((i) => getDayStr(i));

  // Arun: Mon-Fri Morning Shift (08:00 - 16:30), Sat OFF, Sun ON_CALL
  for (let i = 0; i < 5; i++) {
    await prisma.rosterEntry.create({
      data: {
        supportGroupId: sgBackoffice.id,
        personId: personArun.id,
        rosterDate: currentWeekDates[i],
        startTime: "08:00",
        endTime: "16:30",
        timeZone: "Asia/Kolkata",
        rosterStatus: "WORKING",
        notes: "Morning Shift Primary",
        createdBy: managerUser.email,
        updatedBy: managerUser.email,
      },
    });
  }
  await prisma.rosterEntry.create({
    data: {
      supportGroupId: sgBackoffice.id,
      personId: personArun.id,
      rosterDate: currentWeekDates[5],
      startTime: "00:00",
      endTime: "23:59",
      timeZone: "Asia/Kolkata",
      rosterStatus: "OFF",
      notes: "Weekly Off",
      createdBy: managerUser.email,
      updatedBy: managerUser.email,
    },
  });
  await prisma.rosterEntry.create({
    data: {
      supportGroupId: sgBackoffice.id,
      personId: personArun.id,
      rosterDate: currentWeekDates[6],
      startTime: "09:00",
      endTime: "21:00",
      timeZone: "Asia/Kolkata",
      rosterStatus: "ON_CALL",
      notes: "Weekend On-Call Standby",
      createdBy: managerUser.email,
      updatedBy: managerUser.email,
    },
  });

  // Priya: Mon-Fri Evening Overnight Shift (16:00 - 00:30 next day)
  for (let i = 0; i < 5; i++) {
    await prisma.rosterEntry.create({
      data: {
        supportGroupId: sgBackoffice.id,
        personId: personPriya.id,
        rosterDate: currentWeekDates[i],
        startTime: "16:00",
        endTime: "00:30",
        timeZone: "Asia/Kolkata",
        rosterStatus: "WORKING",
        notes: "Evening Shift (Spans Midnight)",
        createdBy: managerUser.email,
        updatedBy: managerUser.email,
      },
    });
  }

  // Rohan: Mon-Wed Night Shift (23:00 - 07:00), Thu-Fri LEAVE
  for (let i = 0; i < 3; i++) {
    await prisma.rosterEntry.create({
      data: {
        supportGroupId: sgBackoffice.id,
        personId: personRohan.id,
        rosterDate: currentWeekDates[i],
        startTime: "23:00",
        endTime: "07:00",
        timeZone: "Asia/Kolkata",
        rosterStatus: "WORKING",
        notes: "Night Graveyard Shift",
        createdBy: managerUser.email,
        updatedBy: managerUser.email,
      },
    });
  }
  for (let i = 3; i < 5; i++) {
    await prisma.rosterEntry.create({
      data: {
        supportGroupId: sgBackoffice.id,
        personId: personRohan.id,
        rosterDate: currentWeekDates[i],
        startTime: "00:00",
        endTime: "23:59",
        timeZone: "Asia/Kolkata",
        rosterStatus: "LEAVE",
        notes: "Approved Medical Leave",
        createdBy: managerUser.email,
        updatedBy: managerUser.email,
      },
    });
  }

  // Sneha: Service Desk Mon-Fri (09:00 - 18:00)
  for (let i = 0; i < 5; i++) {
    await prisma.rosterEntry.create({
      data: {
        supportGroupId: sgServiceDesk.id,
        personId: personSneha.id,
        rosterDate: currentWeekDates[i],
        startTime: "09:00",
        endTime: "18:00",
        timeZone: "Asia/Kolkata",
        rosterStatus: "WORKING",
        notes: "Daytime Service Desk Support",
        createdBy: managerUser.email,
        updatedBy: managerUser.email,
      },
    });
  }

  // 9. Availability Override: Arun has a 2-hour emergency unavailable override today
  const overrideStart = new Date(today);
  overrideStart.setHours(11, 0, 0, 0);
  const overrideEnd = new Date(today);
  overrideEnd.setHours(13, 0, 0, 0);

  await prisma.availabilityOverride.create({
    data: {
      personId: personArun.id,
      supportGroupId: sgBackoffice.id,
      overrideState: "UNAVAILABLE",
      reason: "Urgent medical checkup",
      startAt: overrideStart,
      expiresAt: overrideEnd,
      createdBy: managerUser.email,
    },
  });

  // 10. Initial Calculated Availability States
  await prisma.availabilityState.createMany({
    data: [
      {
        personId: personArun.id,
        supportGroupId: sgBackoffice.id,
        desiredAvailability: true,
        lastKnownBmcAvailability: true,
        effectiveSource: "ROSTER",
        calculationReason: "Active working shift 08:00-16:30",
      },
      {
        personId: personArun.id,
        supportGroupId: sgServiceDesk.id,
        desiredAvailability: false,
        lastKnownBmcAvailability: false,
        effectiveSource: "MISSING_ROSTER_POLICY",
        calculationReason: "Missing roster policy TAKE_NO_ACTION",
      },
      {
        personId: personPriya.id,
        supportGroupId: sgBackoffice.id,
        desiredAvailability: true,
        lastKnownBmcAvailability: true,
        effectiveSource: "ROSTER",
        calculationReason: "Active working shift 16:00-00:30",
      },
      {
        personId: personSneha.id,
        supportGroupId: sgServiceDesk.id,
        desiredAvailability: true,
        lastKnownBmcAvailability: true,
        effectiveSource: "ROSTER",
        calculationReason: "Active working shift 09:00-18:00",
      },
    ],
  });

  // 11. Audit log entries
  console.log("Creating initial audit log entries...");
  await prisma.auditLog.createMany({
    data: [
      {
        entityType: "SYSTEM",
        entityId: "system",
        action: "INITIAL_SEED",
        newValue: JSON.stringify({ message: "Initial database seed completed" }),
        performedBy: adminUser.email,
        correlationId: "seed-" + Date.now(),
      },
      {
        entityType: "AUTHORIZATION",
        entityId: managerUser.id,
        action: "ASSIGN_MANAGER",
        newValue: JSON.stringify({
          manager: managerUser.displayName,
          groupName: sgBackoffice.name,
        }),
        performedBy: adminUser.email,
        correlationId: "seed-" + Date.now(),
      },
      {
        entityType: "ROSTER_ENTRY",
        entityId: personArun.id,
        action: "CREATE_ROSTER_ENTRY",
        newValue: JSON.stringify({
          shift: "Morning Shift",
          week: currentWeekDates[0],
        }),
        performedBy: managerUser.email,
        correlationId: "seed-" + Date.now(),
      },
    ],
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
