-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "employeeNo" VARCHAR(32) NOT NULL,
    "phone" VARCHAR(11),
    "email" VARCHAR(254),
    "department" VARCHAR(50),
    "position" VARCHAR(50),
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "remark" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "person_employeeNo_key" ON "person"("employeeNo");

-- CreateIndex
CREATE INDEX "person_updatedAt_idx" ON "person"("updatedAt");
