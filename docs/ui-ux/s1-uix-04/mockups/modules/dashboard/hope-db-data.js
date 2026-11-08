// Frontend snapshot derived from .files/.sql/HopeDB_audit.sql.txt.
// Replace this object with API responses when the backend is connected.
window.HOPE_DB_DATA = Object.freeze({
  source: "HopeDB_audit.sql.txt",
  snapshotLabel: "Professor-provided SQL seed",
  metrics: {
    totalSales: 688935.47,
    totalPayments: 665326.58,
    outstanding: 23608.89,
    employees: 32,
    activeEmployees: 27,
    customers: 82,
    products: 57,
    priceHistoryEntries: 79,
    salesTransactions: 124,
    paymentRecords: 165,
    departments: 8,
    jobs: 14
  },
  dailyPerformance: [
    { date: "2011-02-10", sales: 9218.82, payments: 24871.08 },
    { date: "2011-02-15", sales: 7416.59, payments: 18620.45 },
    { date: "2011-03-02", sales: 20718.1, payments: 4835.05 },
    { date: "2011-03-05", sales: 9222.57, payments: 13661.79 },
    { date: "2011-03-30", sales: 20483.96, payments: 7519.52 },
    { date: "2011-04-07", sales: 12147.95, payments: 12147.95 },
    { date: "2011-04-10", sales: 181202.57, payments: 7000 }
  ],
  insights: {
    customerTerms: [
      { label: "45 days", value: 30 },
      { label: "30 days", value: 28 },
      { label: "Cash on delivery", value: 24 }
    ],
    productUnits: [
      { label: "Each (ea)", value: 37 },
      { label: "Piece (pc)", value: 20 }
    ],
    employeeStatus: [
      { label: "Active", value: 27 },
      { label: "Separated", value: 5 }
    ],
    employeeGender: [
      { label: "Women", value: 19 },
      { label: "Men", value: 13 }
    ],
    employees: [
      { name: "John Smith", role: "Employee", status: "Active", initials: "JS" },
      { name: "Jane Smith", role: "Employee", status: "Active", initials: "JS" },
      { name: "Don King", role: "Employee", status: "Active", initials: "DK" },
      { name: "Floyd Jenskin", role: "Employee", status: "Active", initials: "FJ" },
      { name: "Bambie Cerudo", role: "Employee", status: "Active", initials: "BC" }
    ],
    monthlyPayments: [
      { label: "Dec", value: 16020.63 },
      { label: "Jan", value: 32836.63 },
      { label: "Feb", value: 108304.60 },
      { label: "Mar", value: 91830.88 },
      { label: "Apr", value: 136735.00 },
      { label: "May", value: 211366.53 }
    ]
  },
  recentRecords: [
    { title: "Sale TR000042", detail: "Datapop - $522.68", module: "Sales", owner: "Don King", status: "Recorded", tone: "success", date: "2020-10-25" },
    { title: "Payment OR000163", detail: "TR000120 - $43,708.17", module: "Payments", owner: "Seed record", status: "Received", tone: "success", date: "2011-05-30" },
    { title: "Payment OR000164", detail: "TR000121 - $12,804.30", module: "Payments", owner: "Seed record", status: "Received", tone: "success", date: "2011-05-30" },
    { title: "Payment OR000165", detail: "TR000122 - $27,587.77", module: "Payments", owner: "Seed record", status: "Received", tone: "success", date: "2011-05-30" }
  ]
});
