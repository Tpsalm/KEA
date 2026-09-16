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
