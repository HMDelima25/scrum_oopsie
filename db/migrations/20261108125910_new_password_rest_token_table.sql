-- migrate:up

-- =====================================================================
-- Password Reset Token Table (US-3)
-- =====================================================================
CREATE TABLE password_reset_token (
    token_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES app_user(user_id),
    token_hash VARCHAR(255) NOT NULL,          -- Hashed token (e.g., SHA-256) for security
    expires_at TIMESTAMPTZ NOT NULL,           -- Expiry timestamp
    is_used BOOLEAN NOT NULL DEFAULT FALSE,    -- One-time use flag
    -- Soft delete & Audit columns
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    stamp VARCHAR(60)
);

-- Index for fast lookup when validating the token from the URL
CREATE INDEX idx_password_reset_token_hash ON password_reset_token(token_hash);

-- =====================================================================
-- Attach Audit & Soft-Delete Triggers
-- (Assumes the trigger functions from HopeDB_audit.sql are already loaded)
-- =====================================================================
CREATE TRIGGER password_reset_token_biu_stamp
    BEFORE INSERT OR UPDATE ON password_reset_token
    FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();

CREATE TRIGGER password_reset_token_bd_block
    BEFORE DELETE ON password_reset_token
    FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER password_reset_token_bt_block
    BEFORE TRUNCATE ON password_reset_token
    FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete();

CREATE TRIGGER password_reset_token_aiu_audit
    AFTER INSERT OR UPDATE ON password_reset_token
    FOR EACH ROW EXECUTE FUNCTION trg_audit_log('token_id');

CREATE VIEW password_reset_token_active AS 
    SELECT * FROM password_reset_token WHERE NOT is_deleted;


-- migrate:down
DROP VIEW IF EXISTS password_reset_token_active;
DROP TABLE IF EXISTS password_reset_token;