CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text,
  user_email text,
  org_names text,
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  last_ping timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
