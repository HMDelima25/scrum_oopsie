const fields = {
  custno: ["Customer code", "text", 5],
  custname: ["Customer name", "text", 20],
  address: ["Address", "text", 50],
  payterm: ["Payment terms", "select", ["COD", "30D", "45D"]],
  prodcode: ["Product code", "text", 6],
  description: ["Description", "text", 30],
  unit: ["Unit", "select", ["pc", "ea", "mtr", "pkg", "ltr"]],
  effdate: ["Effective date", "date"],
  unitprice: ["Unit price", "number"],
  empno: ["Employee number", "text", 5],
  lastname: ["Last name", "text", 15],
  firstname: ["First name", "text", 15],
  gender: ["Gender", "select", ["M", "F"]],
  birthdate: ["Birth date", "date"],
  hiredate: ["Hire date", "date"],
  sepdate: ["Separation date", "date"],
  deptcode: ["Department", "text", 3],
  deptname: ["Department name", "text", 20],
  jobcode: ["Job code", "text", 4],
  jobdesc: ["Job title", "text", 20],
  salary: ["Salary", "number"],
  transno: ["Transaction number", "text", 8],
  salesdate: ["Sale date", "date"],
  quantity: ["Quantity", "number"],
  orno: ["Receipt number", "text", 8],
  paydate: ["Payment date", "date"],
  amount: ["Payment amount", "number"],
};

const resource = (table, pk, module, actions, resourceFields, search) => ({
  table,
  pk,
  module,
  actions,
  fields: resourceFields,
  search,
});

const resources = {
  customers: resource("customer", ["custno"], "customers", ["create", "edit", "delete"], ["custname", "address", "payterm"], ["custno", "custname", "address"]),
  products: resource("product", ["prodcode"], "products", ["create", "edit", "delete"], ["description", "unit"], ["prodcode", "description"]),
  prices: resource("pricehist", ["effdate", "prodcode"], "products", ["create", "edit", "delete"], ["effdate", "prodcode", "unitprice"], ["prodcode"]),
  employees: resource("employee", ["empno"], "hr", ["create", "edit", "delete"], ["lastname", "firstname", "gender", "birthdate", "hiredate", "sepdate"], ["empno", "lastname", "firstname"]),
  departments: resource("department", ["deptcode"], "hr", ["create", "edit", "delete"], ["deptname"], ["deptcode", "deptname"]),
  jobs: resource("job", ["jobcode"], "hr", ["create", "edit", "delete"], ["jobdesc"], ["jobcode", "jobdesc"]),
  "job-history": resource("jobhistory", ["empno", "jobcode", "effdate"], "hr", ["create", "edit", "delete"], ["empno", "jobcode", "effdate", "salary", "deptcode"], ["empno", "jobcode"]),
  sales: resource("sales", ["transno"], "sales", ["create", "edit", "delete"], ["salesdate", "custno", "empno"], ["transno", "custno", "empno"]),
  "sale-details": resource("salesdetail", ["transno", "prodcode"], "sales", ["create", "edit", "delete"], ["transno", "prodcode", "quantity"], ["transno", "prodcode"]),
  payments: resource("payment", ["orno"], "sales", ["create", "edit", "delete"], ["paydate", "amount", "transno"], ["orno", "transno"]),
};

const groups = {
  dashboard: [],
  customers: ["customers"],
  products: ["products", "prices"],
  "human-resources": ["employees", "departments", "jobs", "job-history"],
  sales: ["sales", "sale-details", "payments"],
  reports: ["reports"],
  administrator: ["settings", "audit-log"],
  "user-management": ["users", "roles"],
};

const rightsCatalog = {
  customers: ["view", "create", "edit", "delete"],
  products: ["view", "create", "edit", "delete", "priceHistory"],
  hr: ["view", "create", "edit", "delete", "manageDepartments", "manageJobs", "jobHistory"],
  sales: ["view", "create", "edit", "delete", "detailAdd", "payments"],
  reports: ["view", "topCustomers", "productMaster", "topProducts", "activeEmployees", "allEmployees", "empJobHistory", "topSales"],
  users: ["view", "create", "edit", "block", "assignRights"],
  roles: ["view", "create", "edit"],
  audit: ["view"],
  settings: ["view", "edit"],
};
const rightsCatalogue = Object.fromEntries(
  Object.entries(rightsCatalog).flatMap(([module, actions]) =>
    actions.map((action) => [`${module}.${action}`, `${module === "hr" ? "Human resources" : module[0].toUpperCase() + module.slice(1)} · ${action}`]),
  ),
);

const moduleLabels = {
  customers: "Customers", products: "Products", hr: "Human Resources",
  sales: "Sales", reports: "Reports", users: "Users", roles: "Permission roles",
  audit: "Audit log", settings: "Settings",
};
if (Object.keys(rightsCatalogue).length !== 41) throw new Error('Permission catalogue must contain 41 permissions.');

const lookups = {
  customers: { custno: "customers" },
  prices: { prodcode: "products" },
  "job-history": { empno: "employees", jobcode: "jobs", deptcode: "departments" },
  sales: { custno: "customers", empno: "employees" },
  "sale-details": { transno: "sales", prodcode: "products" },
  payments: { transno: "sales" },
};

const labels = {
  "job-history": "Job history", "sale-details": "Sale details", "audit-log": "Audit log",
};
const autoCodes = {
  customers: { field: "custno", prefix: "C", width: 4 },
  products: { field: "prodcode", prefix: "PR", width: 4 },
  employees: { field: "empno", prefix: "", width: 5 },
  sales: { field: "transno", prefix: "TR", width: 6 },
  payments: { field: "orno", prefix: "OR", width: 6 },
};

const moduleFields = Object.fromEntries(
  Object.entries(resources).map(([key, config]) => [key, config.fields]),
);

module.exports = {
  fields,
  resources,
  groups,
  labels,
  lookups,
  autoCodes,
  rightsCatalogue,
  listFilters: { sales: ["custno"], "sale-details": ["transno"], payments: ["transno"], "job-history": ["empno"] },
  related: {
    employees: [{ resource: "job-history", filter: ["empno"] }],
    sales: [{ resource: "sale-details", filter: ["transno"] }, { resource: "payments", filter: ["transno"] }],
    products: [{ resource: "prices", filter: ["prodcode"] }],
  },
  cellLinks: {
    sales: { custno: { resource: "customers", key: ["custno"] }, empno: { resource: "employees", key: ["empno"] } },
    payments: { transno: { resource: "sales", key: ["transno"] } },
    prices: { prodcode: { resource: "products", key: ["prodcode"] } },
    "job-history": { empno: { resource: "employees", key: ["empno"] } },
    "sale-details": { transno: { resource: "sales", key: ["transno"] }, prodcode: { resource: "products", key: ["prodcode"] } },
  },
  tableFilters: {},
  moduleFields,
};
