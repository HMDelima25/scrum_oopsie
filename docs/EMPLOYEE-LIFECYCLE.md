# Employee jobs and archival

Add Employee includes an optional initial job assignment. Select an active job, optionally select a department, enter salary and effective date, then Save. The effective date initially follows the hire date. The generated employee record and job-history entry save in one transaction; an invalid assignment saves neither. The assignment section requires Add Job History permission in addition to Add Employee.

Click an employee table cell to open the record. Eligible Admin and Superadmin accounts see Fire employee. Clicking it opens a separate confirmation showing the employee's full name and number. Only Confirm fire employee performs the change.

The server sets the separation date to the current Philippine date, records an archive timestamp, and marks the employee inactive. The employee moves from Active to Inactive and displays Archived. Existing job history, sales and payments are preserved, without inactivating those historical records. Active-parent validation prevents new records from being assigned to the archived employee.

Firing requires an approved Admin/Superadmin account; Admin also needs Human Resources view, Employee edit and Employee inactivation rights. It rejects missing confirmation, missing/stale record versions, already inactive/separated employees, and a separation before the hire date. Database functions enforce these boundaries and are inaccessible to anonymous clients. The existing audit records capture the employee status/date change.

POST `/api/employees` accepts an optional `job_assignment` object containing jobcode, optional deptcode, salary and optional effdate. POST `/api/employees/:empno/fire` accepts only `{confirm:true}` and requires the current JSON timestamp through If-Match. The client cannot submit its own separation date to this action.

Migration `20261108001000_employee_lifecycle.sql` adds these functions and the archive timestamp without changing existing employee records. The complete integration suite passes 125 checks, including atomic assignment, invalid-job rollback, permissions, stale confirmation, automatic separation/archival, historical record preservation and anonymous denial. Browser checks saved an employee with a job, confirmed Fire separately, verified the Archived row and separation date, and checked the Add Employee form at 390x650. All write tests used an isolated database; no live employee was fired.
