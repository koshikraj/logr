-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('owned', 'draft', 'published', 'claimed', 'takedown');

-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('userCreated', 'userImported', 'seeded');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "attributedGh" TEXT,
ADD COLUMN     "attributedX" TEXT,
ADD COLUMN     "claimProofToken" TEXT,
ADD COLUMN     "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'owned';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "provenance" "Provenance" NOT NULL DEFAULT 'userCreated',
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProfileSource" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ProfileSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileSource_profileId_idx" ON "ProfileSource"("profileId");

-- AddForeignKey
ALTER TABLE "ProfileSource" ADD CONSTRAINT "ProfileSource_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

