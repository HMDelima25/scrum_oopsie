CREATE TABLE IF NOT EXISTS public.permission_role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    rights JSONB NOT NULL DEFAULT '{}'::jsonb,
    stamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS username VARCHAR(32),
    ADD COLUMN IF NOT EXISTS rights JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS permission_role_id UUID,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
    ON public.users (lower(username))
    WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.app_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_by UUID,
    table_name TEXT NOT NULL,
    record_key TEXT,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB
);

CREATE INDEX IF NOT EXISTS app_audit_events_action_at_idx
    ON public.app_audit_events (action_at DESC);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

ALTER TABLE public.permission_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.permission_role, public.app_audit_events, public.app_settings FROM anon, authenticated;
GRANT ALL ON TABLE public.permission_role, public.app_audit_events, public.app_settings TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';
