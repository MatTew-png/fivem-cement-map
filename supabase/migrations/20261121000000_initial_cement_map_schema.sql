-- Initial Supabase schema for FiveM Cement Cooldown Map
-- Applied to project: cement-cooldown (ibtamnpkagjmnlzuejju, ap-southeast-1)

CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY CHECK (id IN ('branch_1', 'branch_2', 'branch_3', 'branch_4', 'branch_5')),
  custom_name TEXT,
  member_pin_date TEXT,
  member_pin_epoch INTEGER NOT NULL DEFAULT 0 CHECK (member_pin_epoch >= 0),
  leader_pin_epoch INTEGER NOT NULL DEFAULT 0 CHECK (leader_pin_epoch >= 0),
  member_force_logout_after BIGINT NOT NULL DEFAULT 0,
  leader_force_logout_after BIGINT NOT NULL DEFAULT 0,
  spots_seeded BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.groups (id) VALUES
  ('branch_1'),
  ('branch_2'),
  ('branch_3'),
  ('branch_4'),
  ('branch_5')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.spots (
  branch_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  z DOUBLE PRECISION NOT NULL DEFAULT 30.0,
  postal TEXT NOT NULL DEFAULT '',
  cooldown_minutes INTEGER NOT NULL DEFAULT 10,
  yield_description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (branch_id, id)
);

CREATE INDEX IF NOT EXISTS idx_spots_branch_updated
  ON public.spots (branch_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.active_cooldowns (
  branch_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  spot_id TEXT NOT NULL,
  spot_name TEXT NOT NULL,
  started_by TEXT NOT NULL DEFAULT '',
  started_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  PRIMARY KEY (branch_id, spot_id)
);

CREATE INDEX IF NOT EXISTS idx_active_cooldowns_branch_expires
  ON public.active_cooldowns (branch_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_branch_created
  ON public.activity_logs (branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.spot_backups (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  spot_count INTEGER NOT NULL,
  spots JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spot_backups_branch_created
  ON public.spot_backups (branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.security_logs (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  member_name TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  event TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_logs_created
  ON public.security_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ip_bans (
  ip TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  banned_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  ip TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start BIGINT NOT NULL,
  locked_until BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spot_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_client_groups" ON public.groups FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_spots" ON public.spots FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_active_cooldowns" ON public.active_cooldowns FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_activity_logs" ON public.activity_logs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_spot_backups" ON public.spot_backups FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_security_logs" ON public.security_logs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_ip_bans" ON public.ip_bans FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_rate_limits" ON public.rate_limits FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_client_app_settings" ON public.app_settings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
