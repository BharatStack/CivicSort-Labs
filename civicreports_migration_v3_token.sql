-- CivicReports Migration V3: unique tracking token for every citizen report
-- Run this once in Supabase Dashboard > SQL Editor. Safe to re-run.
-- Token format: CSL-<year>-<6-digit sequence>, e.g. CSL-2026-000123

-- 1. Sequence + column
CREATE SEQUENCE IF NOT EXISTS citizen_report_token_seq;
ALTER TABLE citizen_reports ADD COLUMN IF NOT EXISTS token TEXT;

-- 2. Backfill existing reports in the order they were filed
--    (drop the trigger first so a re-run can still fill any missing tokens; it is recreated in step 4)
DROP TRIGGER IF EXISTS tr_set_citizen_report_token ON citizen_reports;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, created_at FROM citizen_reports WHERE token IS NULL ORDER BY created_at, id LOOP
    UPDATE citizen_reports
       SET token = 'CSL-' || to_char(COALESCE(r.created_at, NOW()), 'YYYY') || '-' || lpad(nextval('citizen_report_token_seq')::text, 6, '0')
     WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Unique + required
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citizen_reports_token_key') THEN
    ALTER TABLE citizen_reports ADD CONSTRAINT citizen_reports_token_key UNIQUE (token);
  END IF;
END $$;
ALTER TABLE citizen_reports ALTER COLUMN token SET NOT NULL;

-- 4. Assign the token on insert; never allow it to change afterwards
CREATE OR REPLACE FUNCTION set_citizen_report_token()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.token := 'CSL-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('citizen_report_token_seq')::text, 6, '0');
  ELSE
    NEW.token := OLD.token;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_set_citizen_report_token ON citizen_reports;
CREATE TRIGGER tr_set_citizen_report_token
  BEFORE INSERT OR UPDATE ON citizen_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_citizen_report_token();

-- Done! New reports get a token automatically; resolved reports keep theirs.
