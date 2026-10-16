-- Enquiry source (captured at submission, part of the original record), estimated fee (editable),
-- and daily website analytics copied from Cloudflare Web Analytics.

ALTER TABLE enquiries ADD COLUMN source_channel TEXT;     -- e.g. LinkedIn, Google search, Referral, Direct / unknown
ALTER TABLE enquiries ADD COLUMN referrer_host TEXT;      -- referring website (host name only)
ALTER TABLE enquiries ADD COLUMN landing_page TEXT;       -- first page of the visit, e.g. /services/
ALTER TABLE enquiries ADD COLUMN utm_source TEXT;
ALTER TABLE enquiries ADD COLUMN utm_medium TEXT;
ALTER TABLE enquiries ADD COLUMN utm_campaign TEXT;
CREATE INDEX idx_enquiries_channel ON enquiries (source_channel);

ALTER TABLE enquiry_admin ADD COLUMN estimated_fee INTEGER CHECK (estimated_fee IS NULL OR estimated_fee >= 0);   -- whole pounds

-- One row per day (UTC) of site-wide totals
CREATE TABLE analytics_daily (
  date       TEXT PRIMARY KEY,          -- YYYY-MM-DD
  visits     INTEGER NOT NULL DEFAULT 0,
  pageviews  INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL
);

-- One row per day per page path or referring site
CREATE TABLE analytics_breakdown (
  date      TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('path', 'referrer')),
  key       TEXT NOT NULL,              -- page path, or referring host ('' = none / direct)
  visits    INTEGER NOT NULL DEFAULT 0,
  pageviews INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, kind, key)
);
