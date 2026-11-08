# Inactive records and Human Resources jobs

Business record actions use Make inactive. The first click previews the exact affected IDs, grouped by table, and a separate confirmation applies the change. The related-record chain includes sales, their sale details and payments for a customer; job history and sales for an employee; job history for a job/department; prices and sale details for a product. Shared parent records are not changed. Already inactive rows are left untouched.

The preview is checked again during the transaction. Changed rows or new relationships require a new confirmation. Permissions are required for each affected table, and every update is audited. Nothing is permanently erased. Restore remains per record, with parent records restored first; it does not reactivate unrelated or previously inactive records.

Endpoints: GET `/api/:resource/:key/inactivation` returns the plan; POST `/api/:resource/:key/inactivate` accepts `{plan}` from the preview. The older single-record DELETE endpoint remains compatible and still refuses active children. Both paths enforce authentication and permissions.

Human Resources > Jobs now has a generated Job code plus manual Job name, Job prefix and Job description. The prefix accepts 1–3 letters, is normalized to uppercase, and can be new rather than selected from existing prefixes. Names allow 80 characters and descriptions 500. Codes keep the existing four-character table format: ACC1, ACC2, VP01, VP02, and so on. A three-letter prefix has nine numeric slots; an exhausted prefix is rejected rather than generating an invalid code. Existing codes are preserved. Once saved, the code and its prefix stay fixed; names and descriptions remain editable. Job lookups display the job name.

Migrations 8 and 9 add the grouped-inactivation functions and job fields. Existing job descriptions are retained and initially also populate job names. Customer codes are unchanged.

Validation: 117 integration checks pass, including all ten inactivation previews, stale-plan rejection, per-table permission checks, audited group updates, parent-first restore, new manual prefixes, concurrent code allocation, search, editing and job-history choices. Isolated browser checks confirmed four related records became inactive together, ACC produced ACC1 and saved all fields, and the compact Job form fit at 390x650. The live Supabase schema and form were verified without creating or inactivating live test records.
