# S1-TST-04 — Three-role permission matrix

The executed server matrix covers all 41 catalogue entries: 36 action rights and five module-view gates. Each is exercised against real protected endpoints as User, Admin and Superadmin. This is 123 unique permission/role combinations, with denied and allowed variants for User/Admin. Some rights also apply to multiple resources (for example Sales and Payments), so endpoint assertions exceed the number of unique rights.

Evidence: `test/permission-roles.test.js`; the final full API run passed 168 tests. The suite asserts that its exercised-right set exactly equals `src/config/rights.json`. Superadmin retains fixed authority while ordinary User/Admin grants are changed through the real rights endpoint; neither hidden controls nor fabricated query responses substitute for server enforcement.

| Permission | Label | User | Admin | Superadmin | Server result |
| --- | --- | --- | --- | --- | --- |
| `customers.view` | View Customers | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `customers.add` | Add Customer | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `customers.edit` | Edit Customer | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `customers.delete` | Make Customer inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `products.view` | View Products | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `products.add` | Add Product | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `products.edit` | Edit Product | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `products.delete` | Make Product inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `products.priceAdd` | Add Price | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `products.priceEdit` | Edit Price | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `products.priceDelete` | Make Price inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.view` | View Human Resources | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.jobAdd` | Add Job | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.jobEdit` | Edit Job | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.jobDelete` | Make Job inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.deptAdd` | Add Department | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.deptEdit` | Edit Department | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.deptDelete` | Make Department inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.empAdd` | Add Employee | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.empEdit` | Edit Employee | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.empDelete` | Make Employee inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.jhView` | View Job History | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.jhAdd` | Add Job History | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.jhEdit` | Edit Job History | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `hr.jhDelete` | Make Job History inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.view` | View Sales | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.add` | Add Sale | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.edit` | Edit Sale | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.delete` | Make Sale inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.detailView` | View Sale Details | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.detailAdd` | Add Sale Detail | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.detailEdit` | Edit Sale Detail | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `sales.detailDelete` | Make Sale Detail inactive | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.view` | View Reports | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.topCustomers` | Top Customers | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.productMaster` | Product Master List | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.topProducts` | Top Products | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.activeEmployees` | Active Employees | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.allEmployees` | All Employees | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.empJobHistory` | Employee Job History | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |
| `reports.topSales` | Top Sales | Denied → allowed | Denied → allowed | Allowed (fixed authority) | PASS |

## Agent-operated browser review

| Case | Observed result | Evidence |
| --- | --- | --- |
| QA Superadmin sees five module gates and 36 action checkboxes | PASS | manual-superadmin-rights.png |
| Select all checks 41; Clear removes grants; unselected modules disable their child actions | PASS | Browser DOM count and manual-superadmin-rights.png |
| QA Admin with Customer view/add sees Customers and User Management; denied product/HR/sales links are absent | PASS | manual-admin-users.png |
| QA Admin sees Add Customer but no record Edit/Make inactive without those rights | PASS | Observed customer table and record prompt |
| QA User with Customer view only sees the customer data and no Add/Edit/Make inactive or User Management link | PASS | manual-user-readonly-customers.png |
| QA User's Settings shortcut is visible despite privileged API denial | FAIL, BUG-SP1-007 | manual-user-readonly-customers.png |
| QA User's direct denied Products URL exposes no records but shows an internal JavaScript error | FAIL presentation, BUG-SP1-008 | manual-user-denied-url.png |
| QA User login reaches temporary confirmation rather than a full workspace | Deferred, GAP-SP1-002 | manual-user-temporary-workspace.png |

These manual browser checks cover role visibility and representative controls across all three roles. They are not described as 123 individually performed manual widget checks. Full per-action coverage is automated at the server boundary; the reviewer can repeat UI-specific cases using the fixture server.

## Live permission changes and audit

The named-role suite verifies that editing/deactivating a role changes already-signed-in members' next request, and that module gates clear or disable subordinate actions. Browser S1-RIGHTS-01 checks All/None/module gating and a saved full-name audit entry. The full-name actor, immutable audit and no-self-promotion guards have separate integration tests.

Human tester sign-off: PENDING. Upstream PR/review/main merge: PENDING.
