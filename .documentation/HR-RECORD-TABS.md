# Department and Job popup tabs

Department records open with underlined Overview, Jobs and Employees tabs. Overview retains the department's existing details. Jobs shows only Job code and Job name. Employees shows only Employee number, Last name, First name and Gender. The tables have no search, filters, audit columns, job descriptions or row action columns.

Job records open with Overview and Employees tabs. Overview retains the job's details and lists its current department names/codes. The employee table uses the same four columns as Department records. Existing record actions remain in the footer, with only the X for closing. Tabs switch panes locally, without rebuilding the page, and support arrow keys, Home and End.

Employee membership follows the latest effective employee-directory assignment. Only active, hired and not-yet-separated employees appear. Department Jobs tabs also include active positions explicitly linked to the department, even if unfilled. Job Overview shows its selected department. Legacy jobs without an explicit home use current staff departments as a fallback. See [job department selection](JOB-DEPARTMENTS.md).

GET `/api/departments/:code/members` and `/api/jobs/:code/members` return minimal jobs, employees and departments arrays. The authenticated API and service-only `hope_hr_record_members` function require Human Resources view permission. Missing records return 404; inactive records have empty current-member lists. Data loads when the popup opens, with explicit loading, empty and error states.

Migration `20261108001300_hr_record_members.sql` adds the membership function without modifying business records. The complete integration suite passes 139 checks, including exact response columns, distinct jobs, current transfers, multiple departments per job, inactive/future/separated exclusions, membership changes, permissions and anonymous denial. Browser checks verified both popup layouts, exact table headings, local tab switching, keyboard navigation and a 390x650 employee-table layout.
