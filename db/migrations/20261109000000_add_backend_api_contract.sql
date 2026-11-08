-- migrate:up

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL UNIQUE,
    username VARCHAR(32) UNIQUE,
    name VARCHAR(160) NOT NULL,
    password_hash TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin', 'superadmin')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'blocked')),
    rights JSONB NOT NULL DEFAULT '{}'::jsonb,
    permission_role_id UUID,
    reset_token TEXT,
    reset_token_expires TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    stamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permission_role (
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

ALTER TABLE users
    ADD CONSTRAINT users_permission_role_fk
    FOREIGN KEY (permission_role_id) REFERENCES permission_role(id);

CREATE TABLE app_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_by UUID REFERENCES users(id),
    table_name TEXT NOT NULL,
    record_key TEXT,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB
);

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

CREATE TABLE app_sessions (
    session_id TEXT PRIMARY KEY,
    session_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE code_counter (
    counter_key TEXT PRIMARY KEY,
    last_value BIGINT NOT NULL CHECK (last_value > 0)
);

INSERT INTO users (email, name, role, status)
SELECT au.email,
       trim(concat_ws(' ', au.first_name, au.last_name)),
       CASE lower(r.role_name)
           WHEN 'superadmin' THEN 'superadmin'
           WHEN 'admin' THEN 'admin'
           ELSE 'user'
       END,
       CASE au.status
           WHEN 'active' THEN 'approved'
           WHEN 'suspended' THEN 'blocked'
           ELSE 'pending'
       END
FROM app_user au
LEFT JOIN role r ON r.role_id = au.role_id
WHERE NOT au.is_deleted
ON CONFLICT DO NOTHING;

CREATE INDEX users_status_role_idx ON users(status, role) WHERE NOT is_deleted;
CREATE UNIQUE INDEX users_email_lower_idx ON users(lower(email));
CREATE UNIQUE INDEX users_username_lower_idx ON users(lower(username)) WHERE username IS NOT NULL;
CREATE INDEX app_audit_events_action_at_idx ON app_audit_events(action_at DESC);
CREATE INDEX app_sessions_expires_at_idx ON app_sessions(expires_at);

CREATE FUNCTION set_backend_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.stamp = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_backend_updated_at();

CREATE TRIGGER permission_role_set_updated_at
    BEFORE UPDATE ON permission_role
    FOR EACH ROW EXECUTE FUNCTION set_backend_updated_at();

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'permission_role', 'app_audit_events', 'app_settings',
        'app_sessions', 'code_counter', 'customer', 'product', 'pricehist',
        'employee', 'department', 'job', 'jobhistory', 'sales', 'salesdetail',
        'payment', 'audit_log', 'role', 'module', 'rights', 'app_user',
        'user_permission', 'password_reset_token', 'teams', 'team_members', 'projects'
    ]
    LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
        END IF;
    END LOOP;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
END;
$$;

CREATE FUNCTION set_resource_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'customer', 'product', 'pricehist', 'employee', 'department',
        'job', 'jobhistory', 'sales', 'salesdetail', 'payment'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', table_name);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON public.%I
             FOR EACH ROW EXECUTE FUNCTION set_resource_updated_at()',
            table_name || '_set_updated_at', table_name
        );
    END LOOP;
END;
$$;

CREATE FUNCTION next_entity_code(p_resource TEXT, p_prefix TEXT, p_width INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    table_name TEXT;
    code_column TEXT;
    next_value BIGINT;
    counter_name TEXT := p_resource || ':' || p_prefix;
BEGIN
    CASE p_resource
        WHEN 'customers' THEN table_name := 'customer'; code_column := 'custno';
        WHEN 'products' THEN table_name := 'product'; code_column := 'prodcode';
        WHEN 'employees' THEN table_name := 'employee'; code_column := 'empno';
        WHEN 'sales' THEN table_name := 'sales'; code_column := 'transno';
        WHEN 'payments' THEN table_name := 'payment'; code_column := 'orno';
        ELSE RAISE EXCEPTION 'Unsupported resource for code allocation';
    END CASE;
    IF p_width < 1 OR p_width > 12 OR p_prefix IS NULL THEN
        RAISE EXCEPTION 'Invalid code format';
    END IF;

    EXECUTE format(
        'INSERT INTO code_counter(counter_key, last_value)
         VALUES ($1, COALESCE((SELECT max(substring(%I FROM length($2) + 1)::bigint)
           FROM %I WHERE left(%I, length($2)) = $2), 0) + 1)
         ON CONFLICT (counter_key) DO UPDATE
           SET last_value = code_counter.last_value + 1
         RETURNING last_value',
        code_column, table_name, code_column
    ) INTO next_value USING counter_name, p_prefix;
    RETURN p_prefix || lpad(next_value::text, p_width, '0');
END;
$$;
REVOKE ALL ON FUNCTION next_entity_code(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION next_entity_code(TEXT, TEXT, INTEGER) TO service_role;

CREATE FUNCTION peek_entity_code(p_resource TEXT, p_prefix TEXT, p_width INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    table_name TEXT;
    code_column TEXT;
    highest_existing BIGINT;
    highest_reserved BIGINT;
    counter_name TEXT := p_resource || ':' || p_prefix;
BEGIN
    CASE p_resource
        WHEN 'customers' THEN table_name := 'customer'; code_column := 'custno';
        WHEN 'products' THEN table_name := 'product'; code_column := 'prodcode';
        WHEN 'employees' THEN table_name := 'employee'; code_column := 'empno';
        WHEN 'sales' THEN table_name := 'sales'; code_column := 'transno';
        WHEN 'payments' THEN table_name := 'payment'; code_column := 'orno';
        ELSE RAISE EXCEPTION 'Unsupported resource for code allocation';
    END CASE;
    IF p_width < 1 OR p_width > 12 OR p_prefix IS NULL THEN
        RAISE EXCEPTION 'Invalid code format';
    END IF;
    EXECUTE format(
        'SELECT COALESCE(max(substring(%I FROM length($1) + 1)::bigint), 0)
         FROM %I WHERE left(%I, length($1)) = $1',
        code_column, table_name, code_column
    ) INTO highest_existing USING p_prefix;
    SELECT last_value INTO highest_reserved FROM code_counter WHERE counter_key = counter_name;
    RETURN p_prefix || lpad((greatest(highest_existing, COALESCE(highest_reserved, 0)) + 1)::text, p_width, '0');
END;
$$;
REVOKE ALL ON FUNCTION peek_entity_code(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION peek_entity_code(TEXT, TEXT, INTEGER) TO service_role;

CREATE FUNCTION create_sale_with_lines(p_sale JSONB, p_lines JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    created sales%ROWTYPE;
    line JSONB;
BEGIN
    IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'A sale must include at least one line';
    END IF;
    INSERT INTO sales(transno, salesdate, custno, empno)
    VALUES (p_sale->>'transno', (p_sale->>'salesdate')::date, p_sale->>'custno', p_sale->>'empno')
    RETURNING * INTO created;
    FOR line IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        IF COALESCE((line->>'quantity')::numeric, 0) <= 0 THEN
            RAISE EXCEPTION 'Sale quantities must be positive';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pricehist
            WHERE prodcode = line->>'prodcode' AND effdate <= created.salesdate AND NOT is_deleted
        ) THEN
            RAISE EXCEPTION 'No effective price exists for product % on the sale date', line->>'prodcode';
        END IF;
        INSERT INTO salesdetail(transno, prodcode, quantity)
        VALUES (created.transno, line->>'prodcode', (line->>'quantity')::numeric);
    END LOOP;
    RETURN to_jsonb(created);
END;
$$;
REVOKE ALL ON FUNCTION create_sale_with_lines(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sale_with_lines(JSONB, JSONB) TO service_role;

-- migrate:down
DROP FUNCTION IF EXISTS create_sale_with_lines(JSONB, JSONB);
DROP FUNCTION IF EXISTS peek_entity_code(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS next_entity_code(TEXT, TEXT, INTEGER);
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'customer', 'product', 'pricehist', 'employee', 'department',
        'job', 'jobhistory', 'sales', 'salesdetail', 'payment'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_set_updated_at', table_name);
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS updated_at', table_name);
    END LOOP;
END;
$$;
DROP FUNCTION IF EXISTS set_resource_updated_at();
DROP TRIGGER IF EXISTS permission_role_set_updated_at ON permission_role;
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
DROP FUNCTION IF EXISTS set_backend_updated_at();
DROP TABLE IF EXISTS code_counter;
DROP TABLE IF EXISTS app_sessions;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS app_audit_events;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_permission_role_fk;
DROP TABLE IF EXISTS permission_role;
DROP TABLE IF EXISTS users;
