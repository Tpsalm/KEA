CREATE TABLE IF NOT EXISTS admin_metrics (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS requisitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  days_past_due INTEGER NOT NULL DEFAULT 0,
  amount TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handheld_locks (
  name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vsr_transactions (
  id BIGSERIAL PRIMARY KEY,
  voucher_id TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount TEXT NOT NULL,
  settlement_mode TEXT NOT NULL CHECK (settlement_mode IN ('bank', 'credit')),
  customer_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vsr_loan_status (
  vsr_id TEXT PRIMARY KEY,
  locked BOOLEAN NOT NULL DEFAULT TRUE,
  certified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS supervisor_messages (
  id BIGSERIAL PRIMARY KEY,
  sender TEXT NOT NULL DEFAULT 'Sulaimon',
  recipient TEXT NOT NULL DEFAULT 'Davis Okon',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY,
  staff_code TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supervisor', 'vsr', 'merchandiser')),
  region TEXT NOT NULL,
  hub TEXT NOT NULL,
  supervisor_name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS shift_clock_ins (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT REFERENCES staff(id),
  staff_code TEXT NOT NULL,
  role TEXT NOT NULL,
  hub TEXT NOT NULL,
  clocked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude NUMERIC,
  longitude NUMERIC,
  accuracy_meters NUMERIC,
  telemetry_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS store_checkins (
  id BIGSERIAL PRIMARY KEY,
  staff_code TEXT NOT NULL,
  store_name TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  accuracy_meters NUMERIC,
  radius_match BOOLEAN NOT NULL DEFAULT TRUE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_audits (
  id BIGSERIAL PRIMARY KEY,
  staff_code TEXT NOT NULL,
  store_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  shelf_units INTEGER NOT NULL,
  intake_units INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  planogram_compliant BOOLEAN NOT NULL DEFAULT FALSE,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_actions (
  id BIGSERIAL PRIMARY KEY,
  staff_code TEXT NOT NULL,
  sku TEXT NOT NULL,
  batch_number TEXT,
  action_type TEXT NOT NULL,
  quantity INTEGER,
  source_store TEXT,
  destination_store TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS directives (
  id BIGSERIAL PRIMARY KEY,
  sender_name TEXT NOT NULL,
  audience TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS endorsed_by TEXT;
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS endorsed_at TIMESTAMPTZ;

INSERT INTO staff (staff_code, email, name, role, region, hub, supervisor_name) VALUES
  ('SUP-0491', 'okon@kea.com', 'Davis Okon', 'supervisor', 'Lagos', 'lagos-main', 'Davis Okon'),
  ('VSR-784', 'sulaimon@kea.com', 'Sulaimon', 'vsr', 'Lagos', 'lagos-main', 'Davis Okon'),
  ('M0001', 'kenji@kea.com', 'Kenji Sato', 'merchandiser', 'Lagos', 'lagos-main', 'Davis Okon')
ON CONFLICT (staff_code) DO NOTHING;

INSERT INTO vsr_loan_status (vsr_id, locked)
VALUES ('VSR-784', TRUE)
ON CONFLICT (vsr_id) DO NOTHING;

INSERT INTO admin_metrics (key, value) VALUES
  ('merchandisers', 149),
  ('outlets', 2850),
  ('vsrs', 46),
  ('activeLoans', 29),
  ('dueForFunding', 6)
ON CONFLICT (key) DO NOTHING;

INSERT INTO requisitions (id, name, amount, status) VALUES
  ('REQ-001', 'Shittu Akinsanya', '₦250,000', 'pending'),
  ('REQ-002', 'Paul Olakonipekun', '₦150,000', 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO loans (name, category, days_past_due, amount)
SELECT 'Abel Nduka', 'overdue', 62, '₦180,000'
WHERE NOT EXISTS (SELECT 1 FROM loans WHERE name = 'Abel Nduka');

INSERT INTO loans (name, category, days_past_due, amount)
SELECT 'Dugwu Ukamaka', 'no-loan', 0, '₦0.00'
WHERE NOT EXISTS (SELECT 1 FROM loans WHERE name = 'Dugwu Ukamaka');

INSERT INTO loans (name, category, days_past_due, amount)
SELECT 'Olorunsola Michael', 'no-loan', 0, '₦0.00'
WHERE NOT EXISTS (SELECT 1 FROM loans WHERE name = 'Olorunsola Michael');
