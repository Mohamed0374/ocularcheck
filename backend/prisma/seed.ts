import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { assertNotProduction } from '../src/config/env.guards.js';
import { loadValidatedEnv } from '../src/config/env.validation.js';
import { Locale, Role, Sex } from '../src/generated/prisma/enums.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Idempotent development seed (Phase 2 · P2-T2).
 *
 * - Refuses to run against a production environment (assertNotProduction).
 * - Environment values come exclusively from the validated config layer
 *   (loadValidatedEnv) — no direct process.env reads in this file.
 * - passwordHash is an invalid placeholder so seeded accounts CANNOT log in
 *   until P3-T1 introduces argon2id and regenerates the seed.
 * - All data is clearly fake (example.com e-mails, TEST-nnnn licenses).
 * - Upserts only: a second run changes nothing and creates no duplicates.
 */

/** Placeholder that is not a valid hash of any real scheme. */
const SEED_PASSWORD_PLACEHOLDER = '!seed-placeholder-not-a-real-hash';

/** One simple upsert helper per aggregate keeps the script flat and typed. */
async function upsertPatient(prisma: PrismaClient): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'seed.patient@example.com' },
    update: {},
    create: {
      email: 'seed.patient@example.com',
      passwordHash: SEED_PASSWORD_PLACEHOLDER,
      role: Role.PATIENT,
      fullName: 'Seed Patient (fake data)',
      locale: Locale.EN,
    },
  });
  await prisma.patientProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      dateOfBirth: new Date('1990-01-15T00:00:00Z'),
      sex: Sex.OTHER,
      notes: 'Seeded development data — not real patient data.',
      consentAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
}

type DoctorSeed = {
  readonly email: string;
  readonly fullName: string;
  readonly licenseNumber: string;
  readonly specialty: string;
  readonly verifiedAt: Date | null;
};

const VERIFIED_DOCTOR: DoctorSeed = {
  email: 'seed.doctor.verified@example.com',
  fullName: 'Seed Doctor — Verified (fake data)',
  licenseNumber: 'TEST-0001',
  specialty: 'Ophthalmology',
  verifiedAt: new Date('2026-02-01T00:00:00Z'),
};

const PENDING_DOCTOR: DoctorSeed = {
  email: 'seed.doctor.pending@example.com',
  fullName: 'Seed Doctor — Pending (fake data)',
  licenseNumber: 'TEST-0002',
  specialty: 'Ophthalmology — Retina',
  verifiedAt: null,
};

async function upsertDoctor(prisma: PrismaClient, seed: DoctorSeed): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: {},
    create: {
      email: seed.email,
      passwordHash: SEED_PASSWORD_PLACEHOLDER,
      role: Role.DOCTOR,
      fullName: seed.fullName,
      locale: Locale.EN,
    },
  });
  await prisma.doctorProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      licenseNumber: seed.licenseNumber,
      specialty: seed.specialty,
      verifiedAt: seed.verifiedAt,
    },
  });
}

async function main(): Promise<void> {
  // Fail-fast with named missing/invalid variables (never values) if the
  // required environment is not present (e.g. backend/.env absent).
  const env = loadValidatedEnv();
  assertNotProduction(env);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  try {
    await upsertPatient(prisma);
    await upsertDoctor(prisma, VERIFIED_DOCTOR);
    await upsertDoctor(prisma, PENDING_DOCTOR);
    console.log('Seed complete: 3 users, 1 patient profile, 2 doctor profiles (fake data).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
