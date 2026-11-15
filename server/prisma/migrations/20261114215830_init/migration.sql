-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'IN_PERSON');

-- CreateTable
CREATE TABLE "barbershops" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "barbershops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "barbershop_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barbers" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "barbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price_toman" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "barber_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_name_snapshot" VARCHAR(120) NOT NULL,
    "service_name_snapshot" VARCHAR(120) NOT NULL,
    "duration_minutes_snapshot" INTEGER NOT NULL,
    "price_toman_snapshot" INTEGER NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "booking_source" "BookingSource" NOT NULL DEFAULT 'ONLINE',
    "tracking_code" VARCHAR(20) NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "barbershop_id" UUID,
    "branch_id" UUID,
    "username" VARCHAR(80) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barbershops_slug_key" ON "barbershops"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "barbers_id_branch_id_key" ON "barbers"("id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_id_branch_id_key" ON "services"("id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_tracking_code_key" ON "appointments"("tracking_code");

-- CreateIndex
CREATE INDEX "appointments_customer_id_created_at_idx" ON "appointments"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "appointments_branch_id_start_at_idx" ON "appointments"("branch_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barbers" ADD CONSTRAINT "barbers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_barber_id_branch_id_fkey" FOREIGN KEY ("barber_id", "branch_id") REFERENCES "barbers"("id", "branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_branch_id_fkey" FOREIGN KEY ("service_id", "branch_id") REFERENCES "services"("id", "branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_barbershop_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enable btree_gist for exclusion constraints on UUID + tstzrange
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Services domain checks
ALTER TABLE "services"
ADD CONSTRAINT "services_duration_minutes_check"
CHECK ("duration_minutes" > 0 AND "duration_minutes" % 30 = 0);

ALTER TABLE "services"
ADD CONSTRAINT "services_price_toman_check"
CHECK ("price_toman" >= 0);

-- Appointments R1 (working hours 10:00-20:00 Asia/Tehran, 30-min slots, Saturdays-Thursdays, no Fridays) and snapshot checks
ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_duration_snapshot_check"
CHECK ("duration_minutes_snapshot" > 0 AND "duration_minutes_snapshot" % 30 = 0);

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_price_snapshot_check"
CHECK ("price_toman_snapshot" >= 0);

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_end_at_matches_duration_check"
CHECK ("end_at" = "start_at" + ("duration_minutes_snapshot" * interval '1 minute'));

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_not_friday_tehran_check"
CHECK (EXTRACT(DOW FROM ("start_at" AT TIME ZONE 'Asia/Tehran')) <> 5);

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_slot_minute_tehran_check"
CHECK (
  EXTRACT(MINUTE FROM ("start_at" AT TIME ZONE 'Asia/Tehran')) IN (0, 30)
  AND EXTRACT(SECOND FROM ("start_at" AT TIME ZONE 'Asia/Tehran')) = 0
);

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_same_day_tehran_check"
CHECK (("start_at" AT TIME ZONE 'Asia/Tehran')::date = ("end_at" AT TIME ZONE 'Asia/Tehran')::date);

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_working_hours_tehran_check"
CHECK (
  ("start_at" AT TIME ZONE 'Asia/Tehran')::time >= TIME '10:00:00'
  AND ("end_at" AT TIME ZONE 'Asia/Tehran')::time <= TIME '20:00:00'
);

-- Appointments R2 & R4 (no overlapping active appointments per barber; CANCELLED appointments release the slot)
ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_no_overlap_active"
EXCLUDE USING gist (
  "barber_id" WITH =,
  tstzrange("start_at", "end_at", '[)') WITH &&
)
WHERE ("status" <> 'CANCELLED');
