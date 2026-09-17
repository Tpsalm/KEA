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

CREATE TABLE IF NOT EXISTS auth_users (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT REFERENCES staff(id) ON DELETE CASCADE,
  login TEXT UNIQUE NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'supervisor', 'vsr', 'merchandiser')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_submissions (
  id BIGSERIAL PRIMARY KEY,
  staff_code TEXT NOT NULL,
  role TEXT NOT NULL,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('pod_tracker', 'monthly_report')),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'validated', 'rejected')),
  reviewer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS private_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('super_admin-supervisor', 'supervisor-merchandiser', 'supervisor-vsr')),
  sender TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  login TEXT PRIMARY KEY,
  display_name TEXT,
  phone TEXT,
  avatar_type TEXT,
  avatar_data BYTEA,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_requests (
  id BIGSERIAL PRIMARY KEY,
  sender_login TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS media_uploads (
  id BIGSERIAL PRIMARY KEY,
  staff_code TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  related_context TEXT,
  file_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS endorsed_by TEXT;
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS endorsed_at TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone TEXT;

INSERT INTO staff (staff_code, email, name, role, region, hub, supervisor_name) VALUES
  ('SUP-0491', 'okon@kea.com', 'Davis Okon', 'supervisor', 'Lagos', 'lagos-main', 'Davis Okon'),
  ('VSR-784', 'sulaimon@kea.com', 'Sulaimon', 'vsr', 'Lagos', 'lagos-main', 'Davis Okon'),
  ('M0001', 'kenji@kea.com', 'Kenji Sato', 'merchandiser', 'Lagos', 'lagos-main', 'Davis Okon')
ON CONFLICT (staff_code) DO NOTHING;

UPDATE staff SET phone = CASE staff_code
  WHEN 'SUP-0491' THEN '+2348010000000'
  WHEN 'VSR-784' THEN '+2348010000006'
  WHEN 'M0001' THEN '+2348010000001'
  ELSE phone
END
WHERE staff_code IN ('SUP-0491', 'VSR-784', 'M0001');

INSERT INTO auth_users (staff_id, login, password_salt, password_hash, role)
SELECT s.id, seed.login, seed.password_salt, seed.password_hash, seed.role
FROM (VALUES
  ('admin@kea.com', '6594e187ac6feceeea65b1be6ba3d5ed', '56005218c7e3c666dc371a08c60b4f0edcabed22f1da3b3e53c5e3f02ed3744ddf9c73af54c3eaabefe967804d693e562e1f40fc587b37a508a04be0cb847de0', 'super_admin', 'ADMIN'),
  ('okon@kea.com', '35fb9e60817733f08a9e6eb031e820e4', 'f0c245099efc63fc4d0e1dea1e57fd04f6206c988fbbabec8535d94b866ee5c863e306aaf1dd96d862652128b02905c682657ef1546ae5bcbd08ef4b103deefc', 'supervisor', 'SUP-0491'),
  ('sulaimon@kea.com', '020c77230ab4c5f873a810ec411c5e70', 'e5befda45543f55521a4cddc6d9a9b264bf514f9dbfe364659ef0eb7863a581acf09070b98122324109151f32c27658537882aae3fb1e6bb4cd8667f35b871c9', 'vsr', 'VSR-784'),
  ('kenji@kea.com', '3a131927373de7ad03715032a669d424', 'f40d0fc0c0c17f88187537edf812bc4b73f912c8718020d1d5b5b31844454971806cc73ac2753d59b78b6375c208e809cc2c16f93430019e660553a73b78e799', 'merchandiser', 'M0001')
) AS seed(login, password_salt, password_hash, role, staff_code)
LEFT JOIN staff s ON seed.staff_code = s.staff_code
ON CONFLICT (login) DO NOTHING;

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
