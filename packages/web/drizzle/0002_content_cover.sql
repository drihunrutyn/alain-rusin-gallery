-- Run only if PRAGMA table_info(content) does not list cover_url.
-- Existing production already has this column; do not rerun there.
ALTER TABLE content ADD COLUMN cover_url TEXT NOT NULL DEFAULT '';
