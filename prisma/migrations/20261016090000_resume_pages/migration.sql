-- Resume target page count (#68): the draft and the sheet fit this many pages.
-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "pages" INTEGER NOT NULL DEFAULT 2;

