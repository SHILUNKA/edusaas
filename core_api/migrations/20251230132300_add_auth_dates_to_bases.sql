-- Add authorization date range for franchise management
ALTER TABLE bases ADD COLUMN IF NOT EXISTS auth_start_date DATE;
ALTER TABLE bases ADD COLUMN IF NOT EXISTS auth_end_date DATE;
