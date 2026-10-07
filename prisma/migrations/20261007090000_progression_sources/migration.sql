ALTER TABLE "Developer" ADD COLUMN "fullProfile" BOOLEAN NOT NULL DEFAULT false;
-- Historic counts included other authors. Preserve them but do not award them.
ALTER TABLE "Repository" ADD COLUMN "commitAuthor" TEXT;
