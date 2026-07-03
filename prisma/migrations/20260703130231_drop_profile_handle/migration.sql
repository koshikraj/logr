-- The username is now the single identity: URL slug + public "@handle".
-- The freeform Profile.handle display label is dropped.
ALTER TABLE "Profile" DROP COLUMN "handle";
