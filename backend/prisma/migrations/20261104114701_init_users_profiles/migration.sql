-- CreateEnum
CREATE TYPE "Role" AS ENUM ('patient', 'doctor');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female', 'other');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profiles" (
    "user_id" UUID NOT NULL,
    "date_of_birth" DATE,
    "sex" "Sex",
    "has_diabetes" BOOLEAN NOT NULL DEFAULT false,
    "has_hypertension" BOOLEAN NOT NULL DEFAULT false,
    "family_history_glaucoma" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "consent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "doctor_profiles" (
    "user_id" UUID NOT NULL,
    "license_number" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_profiles_license_number_key" ON "doctor_profiles"("license_number");

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Database-level safety added manually (EDITED BEFORE FIRST APPLY; this IS
-- the first migration). Prisma schemas cannot express column-level CHECK
-- constraints; everything below must be kept consistent when new user
-- columns appear. Migrations are append-only AFTER a migration has been
-- applied elsewhere.
-- ============================================================================

-- (a) Emails must be stored lowercase at database level, regardless of what
--     any client writes. The signup (P3 service layer) also normalizes.
ALTER TABLE "users" ADD CONSTRAINT "users_email_is_lowercase" CHECK ("email" = lower("email"));

-- (b) A user must have a non-empty display name (no whitespace-only names).
ALTER TABLE "users" ADD CONSTRAINT "users_full_name_not_blank" CHECK (trim("full_name") <> '');

-- (c) DOCUMENTED RULE — enforced in the service layer from Phase 3 (NOT
--     expressible as a simple CHECK): a "doctor_profiles" row may only
--     reference a "users" row whose role is 'doctor', and dually a
--     "patient_profiles" row only a 'patient' user. PostgreSQL CHECK
--     constraints cannot reference other tables/rows; defending this rule
--     at database level would require a trigger, which is deliberately out
--     of scope for this migration. See docs/database.md and
--     docs/adr/0003-database-and-orm.md.

