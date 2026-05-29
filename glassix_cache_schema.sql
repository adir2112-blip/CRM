CREATE TABLE IF NOT EXISTS glassix_cache (
  cache_key text PRIMARY KEY,
  tickets text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
