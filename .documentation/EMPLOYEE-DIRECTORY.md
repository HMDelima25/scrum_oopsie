# Employee job and department filters

The Employees table and record popup display Job name and Department name beside the employee's name. The values come from the latest non-inactive job-history assignment effective on the current Philippine date. Future assignments do not appear early. For separated employees, the cutoff is their separation date so their last position remains visible. Same-date assignments use job code order as a deterministic tie breaker. Missing job or department values display Unassigned.

Use the existing Filter icon to enter job or department name text. Both filters combine with the search bar, record status, and the existing HR filters. They run on the server before counting and pagination. Search also matches job/department names and codes. Sorting supports the displayed name columns.

Use the existing Group by icon and choose Job name or Department name. Grouping collects all matching pages and preserves each employee's record action. Unassigned employees have their own group. Employee names and the new columns open the employee record as before.

The `employee_directory` view is read-only to the app's list/detail routes; updates continue to use the employee table and job-history workflow. The view is service-only. Ordinary HR viewers can see directory names without receiving salary, archive metadata or audit stamps, and still need separate Job History permission for that module.

Migration `20261108001200_employee_directory.sql` creates the view. The complete suite passes 132 checks, including effective-date selection, future and separated assignments, combined search/filter/count/pagination, grouping across pages, read-only fields, live assignment updates and anonymous denial. Browser checks covered both group options and combined search, job and department filters. No live employee records were edited for this feature.
