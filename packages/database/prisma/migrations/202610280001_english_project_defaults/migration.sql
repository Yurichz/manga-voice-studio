-- Change defaults for new projects only. Existing project settings and snapshots are preserved.
ALTER TABLE "Project"
  ALTER COLUMN "textLanguage" SET DEFAULT 'en',
  ALTER COLUMN "speechLanguage" SET DEFAULT 'English';
