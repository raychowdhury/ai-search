// Ordered schema migrations. Never edit a shipped migration; add a new one.
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial",
    sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  website_url TEXT NOT NULL,
  website_domain TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  timezone TEXT,
  service_area TEXT NOT NULL,
  services TEXT NOT NULL DEFAULT '[]',
  schedule TEXT NOT NULL DEFAULT 'off',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX businesses_user_idx ON businesses(user_id);

CREATE TABLE question_sets (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  questions TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(business_id, version)
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  question_set_id TEXT NOT NULL REFERENCES question_sets(id),
  question_set_version INTEGER NOT NULL,
  platforms TEXT NOT NULL,
  location_context TEXT NOT NULL,
  data_mode TEXT NOT NULL CHECK (data_mode IN ('live','demo')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','complete','failed')),
  started_at TEXT,
  finished_at TEXT,
  summary TEXT,
  analysis_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX runs_business_idx ON runs(business_id, created_at);

CREATE TABLE checks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  platform TEXT NOT NULL,
  model TEXT,
  location_context TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','success','failed')),
  error_code TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT,
  completed_at TEXT,
  answer_text TEXT,
  raw_response TEXT,
  usage TEXT,
  data_mode TEXT NOT NULL CHECK (data_mode IN ('live','demo')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX checks_run_idx ON checks(run_id);

CREATE TABLE mentions (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  is_owner INTEGER NOT NULL DEFAULT 0,
  is_recommended INTEGER NOT NULL DEFAULT 0,
  evidence_text TEXT NOT NULL,
  evidence_start INTEGER NOT NULL,
  evidence_end INTEGER NOT NULL,
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('name_match','llm','demo')),
  created_at TEXT NOT NULL
);
CREATE INDEX mentions_check_idx ON mentions(check_id);

CREATE TABLE citations (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  is_owner_domain INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX citations_check_idx ON citations(check_id);

CREATE TABLE audits (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','complete','failed_fetch')),
  data_mode TEXT NOT NULL CHECK (data_mode IN ('live','demo')),
  started_at TEXT,
  finished_at TEXT,
  pages TEXT NOT NULL DEFAULT '[]',
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX audits_business_idx ON audits(business_id, created_at);

CREATE TABLE audit_findings (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('good','warn','missing')),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  evidence TEXT,
  page_url TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_findings_audit_idx ON audit_findings(audit_id);

CREATE TABLE recommendations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  why TEXT NOT NULL,
  evidence TEXT NOT NULL,
  suggested_copy TEXT,
  effort TEXT NOT NULL CHECK (effort IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  status_changed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX recommendations_run_idx ON recommendations(run_id, rank);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TEXT NOT NULL,
  locked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX jobs_status_idx ON jobs(status, run_after);
`,
  },
];
