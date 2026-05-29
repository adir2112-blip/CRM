CREATE TABLE IF NOT EXISTS glassix_messages (
  message_id text PRIMARY KEY,
  ticket_id text NOT NULL,
  text text,
  sender_name text,
  sender_type text,
  created_at timestamptz,
  ticket_data text
);
CREATE INDEX IF NOT EXISTS idx_glassix_messages_ticket ON glassix_messages(ticket_id);
