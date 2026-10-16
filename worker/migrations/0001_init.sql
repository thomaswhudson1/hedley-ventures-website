-- Hedley Ventures enquiry system: initial schema.
-- Original submissions (enquiries) are stored separately from the fields edited in the dashboard (enquiry_admin)
-- and are never changed after they are received.

CREATE TABLE enquiries (
  id             TEXT PRIMARY KEY,                 -- random UUID, used in dashboard links
  ref            TEXT NOT NULL UNIQUE,             -- short human reference, e.g. HV-261016-7Q4K
  received_at    TEXT NOT NULL,                    -- ISO 8601, UTC
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  company        TEXT NOT NULL,
  service        TEXT NOT NULL CHECK (service IN ('Fundraising Advisory', 'Fractional CFO Support', 'Both', 'Something else')),
  raise_amount   TEXT CHECK (raise_amount IS NULL OR raise_amount IN ('Under £2m', '£2m–£5m', '£5m–£10m', '£10m+', 'Not yet decided')),
  raise_timing   TEXT CHECK (raise_timing IS NULL OR raise_timing IN ('Immediately / Already fundraising', 'Within the next 3 months', 'In 3–6 months', 'In 6+ months / Just exploring')),
  traction       TEXT NOT NULL CHECK (traction IN ('Pre-revenue', 'Under £50k per month', '£50k–£150k per month', '£150k–£300k per month', '£300k–£500k per month', 'Over £500k per month')),
  message        TEXT,
  submission_key TEXT NOT NULL UNIQUE,             -- one per form load; stops double submissions
  fingerprint    TEXT NOT NULL                     -- hash of email + company + message; stops repeat sends
);
CREATE INDEX idx_enquiries_received ON enquiries (received_at DESC);
CREATE INDEX idx_enquiries_fingerprint ON enquiries (fingerprint, received_at);

CREATE TABLE enquiry_admin (
  enquiry_id     TEXT PRIMARY KEY REFERENCES enquiries (id),
  status         TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Meeting arranged', 'Proposal sent', 'Won', 'Not proceeding')),
  priority       TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  notes          TEXT NOT NULL DEFAULT '',
  last_contacted TEXT,                             -- YYYY-MM-DD
  next_follow_up TEXT,                             -- YYYY-MM-DD
  archived_at    TEXT,                             -- set = archived (never hard-deleted)
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_admin_status ON enquiry_admin (status);
CREATE INDEX idx_admin_follow_up ON enquiry_admin (next_follow_up);
CREATE INDEX idx_admin_archived ON enquiry_admin (archived_at);

CREATE TABLE notifications (
  enquiry_id      TEXT PRIMARY KEY REFERENCES enquiries (id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  last_attempt_at TEXT,
  sent_at         TEXT,
  provider_id     TEXT
);
CREATE INDEX idx_notifications_status ON notifications (status);

-- Rate limiting: a salted one-way hash of the connection's IP address (never the IP itself), deleted after 2 days.
CREATE TABLE submission_attempts (
  ip_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_attempts_ip ON submission_attempts (ip_hash, created_at);

CREATE TABLE app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
