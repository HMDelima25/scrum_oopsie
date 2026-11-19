window.HOPE_MODULES = {
  customers: {
    eyebrow: "Customer management", title: "Customers", description: "Manage customer records, addresses, and payment terms.", action: "Add customer", stats: [["Total customers","82","+6 seeded"],["COD accounts","24","Payment due now"],["Term accounts","58","30D and 45D"]],
    columns: ["Customer", "Address", "Payment term", "Status", "Actions"],
    rows: [
      ["C0001|Globus Medical, Inc", "2560 Gen Armistead Ave, Audubon CA", "30 days", "Active", "Seed record", "Edit|Delete"],
      ["C0002|RF Industries, Inc", "7610 Miramar Rd, San Diego CA", "45 days", "Active", "Seed record", "Edit|Delete"],
      ["C0003|Trisha Macdowell", "7642 Clairemont Mesa Blvd, San Diego CA", "COD", "Active", "Seed record", "Edit|Delete"],
      ["C0004|HMS Holdings, Inc", "1000 So Fremont Ave, Alhambra CA", "45 days", "Active", "Seed record", "Edit|Delete"],
      ["C0005|Christian Andersen", "1120 Lincoln St, Sacramento CA", "COD", "Active", "Seed record", "Edit|Delete"],
      ["C0006|Astronics, Inc", "2 Orion, Aliso Viejo CA", "30 days", "Active", "Seed record", "Edit|Delete"]
    ]
  },
  products: {
    eyebrow: "Product management", title: "Products", description: "Maintain the product catalog and open each product's price history.", action: "Add product", stats: [["Total products","57","Catalog records"],["Price entries","79","Historical prices"],["Units supported","2","ea and pc"]],
    columns: ["Product", "Description", "Unit", "Current price", "Price history", "Status", "Actions"],
    rows: [
      ["AD0001|Toshiba Canvio 1 TB", "Storage device", "ea", "$58.00", "View prices", "Active", "Seed import", "Edit|Delete"],
      ["AD0002|WD Ultra 1TB", "Storage device", "ea", "$69.99", "View prices", "Active", "Seed import", "Edit|Delete"],
      ["AD0003|Seagate Bracuda 1TB", "Storage device", "ea", "$54.44", "View prices", "Active", "Seed import", "Edit|Delete"],
      ["AD0004|Transcend 1 TB", "Storage device", "ea", "$71.99", "View prices", "Active", "Seed import", "Edit|Delete"],
      ["AK0001|HP Pavilion DV6000", "Computer", "pc", "$12.00", "View prices", "Active", "Seed import", "Edit|Delete"],
      ["AK0002|Micro Innovations Kb", "Accessory", "pc", "$8.37", "View prices", "Active", "Seed import", "Edit|Delete"]
    ]
  },
  "human-resources": {
    eyebrow: "People and organization", title: "Human Resources", description: "Review employee records and open job history without exposing it in navigation.", action: "Add employee", stats: [["Total employees","32","Seeded records"],["Active employees","27","No separation date"],["Departments","8","14 job roles"]],
    columns: ["Employee", "Gender", "Birth date", "Hire date", "Separation", "Status", "Actions"],
    rows: [
      ["00001|John Smith", "Male", "Feb 20, 1985", "May 11, 2010", "-", "Active", "Seed import", "History|Edit|Delete"],
      ["00003|Jane Smith", "Female", "May 16, 1990", "May 11, 2010", "-", "Active", "Seed import", "History|Edit|Delete"],
      ["00005|Don King", "Male", "Feb 14, 1986", "Jun 23, 2010", "-", "Active", "Seed import", "History|Edit|Delete"],
      ["00007|Floyd Jenskin", "Male", "Feb 20, 1990", "May 30, 2010", "-", "Active", "Seed import", "History|Edit|Delete"],
      ["00009|Bambie Cerudo", "Female", "Jun 23, 1983", "May 30, 2010", "-", "Active", "Seed import", "History|Edit|Delete"],
      ["00015|Maggie Zulueta", "Female", "Aug 3, 1990", "Jul 5, 2010", "Mar 30, 2011", "Active", "Seed import", "History|Edit|Delete"]
    ],
    views: {
      employees: { label: "Employees", action: "Add employee" },
      jobs: { label: "Jobs", action: "Add job", columns: ["Job", "Description", "Status", "Actions"], rows: [["PRES|President","Executive leadership","Active","Edit|Delete"],["VP|Vice president","Executive leadership","Active","Edit|Delete"],["MGR|Manager","Management","Active","Edit|Delete"],["SA1|Sales Agent 1","Sales","Active","Edit|Delete"],["PR1|Programmer 1","Information technology","Active","Edit|Delete"],["HRS|HR Specialist","Human resources","Active","Edit|Delete"]] },
      departments: { label: "Departments", action: "Add department", columns: ["Department", "Description", "Status", "Actions"], rows: [["ACT|Accounting","Accounting","Active","Edit|Delete"],["BR1|Sales Branch 1","Sales","Active","Edit|Delete"],["EXC|Executive","Executive","Active","Edit|Delete"],["HRD|Human Resource","People operations","Active","Edit|Delete"],["IT|Information Tech","Technology","Active","Edit|Delete"],["WHS|Warehouse","Inventory operations","Active","Edit|Delete"]] }
    }
  },
  sales: {
    eyebrow: "Sales management", title: "Sales", description: "Review transaction headers and open their detail lines and payments.", action: "New sale", stats: [["Transactions","124","Sales headers"],["Sales value","$688.9K","Calculated total"],["Payments","$665.3K","165 receipts"]],
    columns: ["Transaction", "Date", "Customer", "Employee", "Total", "Status", "Actions"],
    rows: [
      ["TR000001|Sale", "Jun 27, 2010", "Globus Medical, Inc", "Don King", "$3,284.70", "Active", "Seed import", "View details|Edit|Delete"],
      ["TR000002|Sale", "Jul 5, 2010", "Trisha Macdowell", "Don King", "$1,581.72", "Active", "Seed import", "View details|Edit|Delete"],
      ["TR000003|Sale", "Jul 5, 2010", "RF Industries, Inc", "Maggie Zulueta", "$7.50", "Active", "Seed import", "View details|Edit|Delete"],
      ["TR000004|Sale", "Jul 7, 2010", "HMS Holdings, Inc", "Nelia Celestino", "$5,700.04", "Active", "Seed import", "View details|Edit|Delete"],
      ["TR000005|Sale", "Jul 9, 2010", "Christian Andersen", "Nehemiah Esperanza", "$924.99", "Active", "Seed import", "View details|Edit|Delete"],
      ["TR000006|Sale", "Jul 7, 2010", "Globus Medical, Inc", "Don King", "$2,095.00", "Active", "Seed import", "View details|Edit|Delete"]
    ],
    views: {
      sales: { label: "Sales", action: "New sale" },
      payments: { label: "Payments", action: "Record payment", columns: ["Receipt", "Date", "Transaction", "Amount", "Status", "Actions"], rows: [["OR000001|Official receipt","Jun 20, 2010","TR000001","$3,284.70","Active","Edit|Delete"],["OR000002|Official receipt","Jul 5, 2010","TR000002","$1,581.72","Active","Edit|Delete"],["OR000003|Official receipt","Jul 5, 2010","TR000003","$7.50","Active","Edit|Delete"],["OR000004|Official receipt","Jul 7, 2010","TR000007","$57.74","Active","Edit|Delete"],["OR000005|Official receipt","Jul 9, 2010","TR000005","$924.99","Active","Edit|Delete"]] }
    }
  },
  "user-management": {
    eyebrow: "Administration", title: "User Management", description: "Review users and arrange permission-based roles.", action: "Add role", stats: [["Users","2","Visible to this Admin"],["Roles","3","Ordered by access level"],["Assignable rights","36","Across five groups"]],
    columns: ["User", "Email", "Role", "Access", "Status", "Actions"],
    rows: [
      ["USR-001|Alex Rivera","alex.rivera@hopeinc.com","User","Allowed","Active","Prototype requirement","Block|Rights|Edit"],
      ["ADM-002|Operations Admin","admin@hopeinc.com","Admin","Allowed","Active","Prototype requirement","—"]
    ],
    views: {
      users: { label: "Users", action: "Add user" },
      roles: { label: "Roles", action: "Add role", columns: ["Role", "Description", "Active members", "Permissions", "Status", "Actions"], rows: [["ROLE-01|Administrator","Operational administration without Superadmin access","1 active member","36 permissions","Active","Edit role"],["ROLE-02|Standard User","Daily operational access granted by permissions","1 active member","0 permissions","Active","Edit role"],["ROLE-03|Read-only Analyst","Reporting and record-view access","0 active members","7 permissions","Active","Edit role"]] }
    }
  }
};
