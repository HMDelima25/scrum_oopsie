-- migrate:up
CREATE VIEW customer_balance WITH (security_invoker=true) AS
SELECT c.*,
       COALESCE(b.outstanding_balance, 0::numeric) AS outstanding_balance
FROM customer c
LEFT JOIN (
  SELECT custno, SUM(GREATEST(balance, 0)) AS outstanding_balance
  FROM sales_balance
  GROUP BY custno
) b USING (custno);

REVOKE ALL ON customer_balance FROM PUBLIC, anon, authenticated;
GRANT SELECT ON customer_balance TO service_role;
INSERT INTO app_migration(version) VALUES('202611220020_customer_outstanding_balance');
NOTIFY pgrst, 'reload schema';

-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
