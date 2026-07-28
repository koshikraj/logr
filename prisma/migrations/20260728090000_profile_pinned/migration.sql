-- Owner-curated pins: JSON string array of event ids shown as the "pinned"
-- rail on the public page (replaces "recent" when non-empty; max 6).
ALTER TABLE "Profile" ADD COLUMN "pinned" TEXT NOT NULL DEFAULT '[]';
