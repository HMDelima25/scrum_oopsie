-- migrate:up

-- =====================================================================
-- 1. Core RBAC Tables
-- =====================================================================
CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE module (
    module_id SERIAL PRIMARY KEY,
    module_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE rights (
    right_id SERIAL PRIMARY KEY,
    module_id INT NOT NULL REFERENCES module(module_id),
    right_name VARCHAR(50) NOT NULL,
    UNIQUE (module_id, right_name)
);

-- =====================================================================
-- 2. App User Table (US-1)
-- =====================================================================
CREATE TABLE app_user (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,       -- Enforces duplicate rejection at DB level
    role_id INT REFERENCES role(role_id),
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE, -- Blocked flag
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    -- Soft delete & Audit columns
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    stamp VARCHAR(60)
);

-- =====================================================================
-- 3. User Permission Table (US-6)
-- =====================================================================
CREATE TABLE user_permission (
    permission_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES app_user(user_id),
    right_id INT NOT NULL REFERENCES rights(right_id),
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    -- Soft delete & Audit columns
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    stamp VARCHAR(60),
    UNIQUE (user_id, right_id)
);

-- =====================================================================
-- 4. Seed Initial Data
-- =====================================================================
INSERT INTO role (role_name) VALUES ('User'), ('Admin'), ('Superadmin');

INSERT INTO module (module_name) VALUES 
    ('Customer'), ('Product'), ('Human Resources'), ('Sales'), ('Reports');

-- Note: You would insert the 36 specific rights here mapped to their respective modules.
-- Example: INSERT INTO rights (module_id, right_name) VALUES (1, 'View'), (1, 'Create')...

-- =====================================================================
-- 5. Attach Audit & Soft-Delete Triggers
-- (Assumes the trigger functions from HopeDB_audit.sql are already loaded)
-- =====================================================================

-- app_user triggers
CREATE TRIGGER app_user_biu_stamp
    BEFORE INSERT OR UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();

CREATE TRIGGER app_user_bd_block
    BEFORE DELETE ON app_user
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER app_user_bt_block
    BEFORE TRUNCATE ON app_user
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER app_user_aiu_audit
    AFTER INSERT OR UPDATE ON app_user
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('user_id');

CREATE VIEW app_user_active AS 
    SELECT * FROM app_user WHERE NOT is_deleted;


-- user_permission triggers
CREATE TRIGGER user_permission_biu_stamp
    BEFORE INSERT OR UPDATE ON user_permission
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();

CREATE TRIGGER user_permission_bd_block
    BEFORE DELETE ON user_permission
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER user_permission_bt_block
    BEFORE TRUNCATE ON user_permission
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER user_permission_aiu_audit
    AFTER INSERT OR UPDATE ON user_permission
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('user_id', 'right_id');

CREATE VIEW user_permission_active AS 
    SELECT * FROM user_permission WHERE NOT is_deleted;


-- migrate:down
DROP VIEW IF EXISTS user_permission_active;
DROP VIEW IF EXISTS app_user_active;
DROP TABLE IF EXISTS user_permission;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS rights;
DROP TABLE IF EXISTS module;
DROP TABLE IF EXISTS role;