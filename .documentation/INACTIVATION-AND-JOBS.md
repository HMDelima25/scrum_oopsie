# Inactive records and Human Resources jobs

Business record actions use Make inactive. The first click previews the exact affected IDs, grouped by table, and a separate confirmation applies the change. The related-record chain includes sales, their sale details and payments for a customer; job history and sales for an employee; job history for a job/department; prices and sale details for a product. Shared parent records are not changed. Already inactive rows are left untouched.

The preview is checked again during the transaction. Changed rows or new relationships require a new confirmation. Permissions are required for each affected table, and every update is audited. Nothing is permanently erased. Restore remains per record, with parent records restored first; it does not reactivate unrelated or previously inactive records.

Endpoints: GET `/api/:resource/:key/inactivation` returns the plan; POST `/api/:resource/:key/inactivate` accepts `{plan}` from the preview. The older single-record DELETE endpoint remains compatible and still refuses active children. Both paths enforce authentication and permissions.

Human Resources > Jobs has a generated Job code plus manual Job name, Department selection and Job description. Select an existing active department; the server derives the code prefix. Existing codes stay fixed. Names allow 80 characters and descriptions 500. Job lookups display the job name. See [the current department-based job workflow](JOB-DEPARTMENTS.md).

Migrations 8 and 9 add the grouped-inactivation functions and job fields. Existing job descriptions are retained and initially also populate job names. Customer codes are unchanged.

Validation: 117 integration checks pass, including all ten inactivation previews, stale-plan rejection, per-table permission checks, audited group updates, parent-first restore, new manual prefixes, concurrent code allocation, search, editing and job-history choices. Isolated browser checks confirmed four related records became inactive together, ACC produced ACC1 and saved all fields, and the compact Job form fit at 390x650. The live Supabase schema and form were verified without creating or inactivating live test records.
