-- migrate:up
-- Keep job titles in jobname; describe duties separately.
SELECT set_config('app.username','job-description-update',true);
UPDATE job j SET jobname=v.title,jobdesc=v.description
FROM (VALUES
 ('ACCT','Accountant','Maintains financial records and prepares reports'),
 ('ANYS','Analyst','Analyzes business data to improve decisions'),
 ('CLK1','Clerk 1','Maintains office records and processes documents'),
 ('CLK2','Clerk 2','Coordinates administrative records and supports operations'),
 ('HRS','HR Specialist','Manages recruitment, employee relations, and records'),
 ('MGR','Manager','Plans team activities and oversees operations'),
 ('PR1','Programmer 1','Develops software features and fixes defects'),
 ('PR2','Programmer 2','Maintains software systems and improves performance'),
 ('PRES','President','Directs company strategy and overall operations'),
 ('SA1','Sales Agent 1','Promotes products and manages customer relationships'),
 ('SA2','Sales Agent 2','Generates sales leads and supports customers'),
 ('SA3','Inactive job 1','Archived sales position supporting former customer accounts'),
 ('SA4','Inactive job 2','Archived sales position supporting former customer accounts'),
 ('SA5','Inactive job 3','Archived sales position supporting former customer accounts'),
 ('SA6','Inactive job 4','Archived sales position supporting former customer accounts'),
 ('SA7','Inactive job 5','Archived sales position supporting former customer accounts'),
 ('SPVR','Supervisor','Supervises daily work and monitors performance'),
 ('VP','Vice president','Supports company strategy and oversees departments'),
 ('WMAN','Warehouse man','Receives, stores, and dispatches warehouse goods')
) AS v(code,title,description)
WHERE j.jobcode=v.code AND j.jobname=v.title AND j.jobdesc=v.title;
INSERT INTO app_migration(version) VALUES('202611080011_job_descriptions');
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only data update'; END $$;
