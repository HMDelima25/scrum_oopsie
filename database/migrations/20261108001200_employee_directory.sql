-- migrate:up
CREATE VIEW employee_directory WITH (security_invoker=true) AS
SELECT e.*,h.jobcode,j.jobname,h.deptcode,d.deptname
FROM employee e
LEFT JOIN LATERAL (
 SELECT history.jobcode,history.deptcode FROM jobhistory history
 WHERE history.empno=e.empno AND NOT history.is_deleted
 AND history.effdate<=least((clock_timestamp() AT TIME ZONE 'Asia/Manila')::date,coalesce(e.sepdate,(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date))
 ORDER BY history.effdate DESC,history.jobcode ASC LIMIT 1
) h ON true
LEFT JOIN job j ON j.jobcode=h.jobcode
LEFT JOIN department d ON d.deptcode=h.deptcode;
REVOKE ALL ON employee_directory FROM PUBLIC,anon,authenticated;
GRANT SELECT ON employee_directory TO service_role;
INSERT INTO app_migration(version) VALUES('202611080012_employee_directory');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
