# Jobs select an existing department

Add Job now has Job name, Department, and Job description. Department is a required selector of existing active departments. The manual Job prefix field is removed. The server derives the prefix from the department code's leading letters and allocates the next job number using the existing four-character format: ACT generates ACT1; IT generates IT01; BR1 and BR2 share the BR numeric sequence but retain their different department links. Code previews do not reserve numbers; saving reserves a unique number transactionally. Inactive or unknown departments, typed prefixes and supplied job IDs are rejected for new jobs.

Each new job stores its selected department. The Jobs table shows Department name. Department popup Jobs tabs include explicitly linked active jobs even before employees are assigned. Job popup Overview shows the selected department. Legacy jobs with no explicit home retain current-staff assignment fallback in those popups.

Existing job codes, names, descriptions and employee assignment history are preserved. Migration 14 links an existing job automatically only when its current staff assignments identify exactly one department; ambiguous or unfilled legacy roles stay unassigned until a department is selected in Edit. Editing a job's department preserves its code and does not silently transfer employee job histories.

Department inactivation previews include its linked jobs, update children first, and retain the existing confirmation, permission and restore-parent checks. The employee job-history report continues to use the department recorded on each historical assignment rather than the job's current home department.

GET `/api/next-code/jobs?deptcode=...` previews the generated code. POST `/api/jobs` takes jobname, deptcode and jobdesc. The session must have Add Job permission. The service-only creation function validates and locks the active department while allocating and saving the job.

Migration `20261108001400_job_departments.sql` adds the department link, job-directory view and related functions. The complete suite passes 143 checks, covering concurrent allocation, inactive/forged choices, saved links, unfilled department jobs, code preservation, cascaded inactivation/restore and anonymous denial. Browser checks selected a department, previewed and saved a generated code, verified the unfilled job in the department popup, and checked the form at 390x650. All write tests used an isolated database.
