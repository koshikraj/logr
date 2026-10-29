-- Resume builder (#66): one owner-edited resume per profile, generated from the log.
-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'modern',
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "document" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resume_profileId_key" ON "Resume"("profileId");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

