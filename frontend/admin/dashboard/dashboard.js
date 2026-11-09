(() => {
const sidebar = document.querySelector("#sidebar");
const dashboardShell = document.querySelector(".dashboard-shell");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const menuButton = document.querySelector("#mobile-menu");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#dashboard-search");
const sidebarPreferenceKey = "hopeSidebarExpanded";
let toastTimer;
let databaseData = window.HOPE_DB_DATA;

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function renderDatabaseSnapshot() {
  if (!databaseData) {
    showToast("The live records could not be loaded.");
    return;
  }

  const { metrics } = databaseData;
  const collectionRate = metrics.totalSales ? (metrics.totalPayments / metrics.totalSales) * 100 : 0;
  document.querySelector("#metric-sales").textContent = formatMoney(metrics.totalSales);
  document.querySelector("#metric-sales-note").textContent = `${metrics.salesTransactions} saved sales transactions`;
  document.querySelector("#metric-outstanding").textContent = formatMoney(metrics.outstanding);
  document.querySelector("#metric-outstanding-note").textContent = `${metrics.paymentRecords} payment records`;
  document.querySelector("#collection-progress").style.width = `${Math.min(collectionRate, 100)}%`;
  document.querySelector("#collection-note").textContent = `${collectionRate.toFixed(1)}% of sales collected`;
  document.querySelector("#metric-employees").textContent = metrics.activeEmployees;
  document.querySelector("#metric-employees-note").textContent = `${metrics.employees} total employees saved`;
  document.querySelector("#employee-total").textContent = `${metrics.employees} staff`;
  document.querySelector("#department-total").textContent = `${metrics.departments} depts`;
  document.querySelector("#job-total").textContent = `${metrics.jobs} jobs`;
  document.querySelector("#metric-products").textContent = metrics.products;
  document.querySelector("#metric-products-note").textContent = `${metrics.priceHistoryEntries} price-history entries`;
  document.querySelector("#product-count").textContent = `${metrics.products} products`;
  document.querySelector("#price-count").textContent = `${metrics.priceHistoryEntries} prices`;
  document.querySelector("#chart-total").textContent = formatMoney(metrics.totalSales);
  document.querySelector("#data-source-label").textContent = databaseData.snapshotLabel;

  const maximum = Math.max(...databaseData.dailyPerformance.flatMap((item) => [item.sales, item.payments]));
  document.querySelector("#payment-chart").innerHTML = databaseData.dailyPerformance.map((item) => {
    const salesHeight = item.sales ? Math.max(8, (item.sales / maximum) * 100) : 0;
    const paymentHeight = item.payments ? Math.max(8, (item.payments / maximum) * 100) : 0;
    const label = new Date(`${item.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<div title="Sales ${formatMoney(item.sales)}; Payments ${formatMoney(item.payments)}"><span class="bar-pair"><i class="bar-sales" style="height:${salesHeight}%"></i><i class="bar-payments" style="height:${paymentHeight}%"></i></span><small>${label}</small></div>`;
  }).join("");

  document.querySelector("#activity-body").innerHTML = databaseData.recentRecords.map((record) => `
    <tr>
      <td><strong>${record.title}</strong><span>${record.detail}</span></td>
      <td>${record.module}</td><td>${record.owner}</td>
      <td><span class="status status--${record.tone}">${record.status}</span></td><td>${record.date}</td>
    </tr>`).join("");

  renderInsightViews(metrics, collectionRate);
}

function renderDistribution(items, listSelector, donutSelector) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const colors = ["var(--gold)", "var(--ocean)", "var(--navy)"];
  const stops = items.map((item, index) => {
    const start = cursor;
    cursor += (item.value / (total || 1)) * 100;
    return `${colors[index]} ${start}% ${cursor}%`;
  });
  document.querySelector(donutSelector).style.background = `conic-gradient(${stops.join(",")})`;
  document.querySelector(listSelector).innerHTML = items.map((item, index) => `
    <div><i style="--swatch:${colors[index]}"></i><span>${item.label}</span><strong>${item.value}</strong><small>${((item.value / (total || 1)) * 100).toFixed(0)}%</small></div>`).join("");
}

function renderHorizontalBars(items, selector) {
  const maximum = Math.max(...items.map((item) => item.value));
  document.querySelector(selector).innerHTML = items.map((item) => `
    <div class="horizontal-bar"><span>${item.label}</span><strong>${item.value}</strong><i><b style="width:${(item.value / (maximum || 1)) * 100}%"></b></i></div>`).join("");
}

function renderInsightViews(metrics, collectionRate) {
  document.querySelector("#operations-customers").textContent = metrics.customers;
  document.querySelector("#operations-products").textContent = metrics.products;
  document.querySelector("#operations-sales").textContent = metrics.salesTransactions;
  renderDistribution(databaseData.insights.customerTerms, "#terms-list", "#terms-donut");
  renderHorizontalBars(databaseData.insights.productUnits, "#unit-bars");
  document.querySelector("#operations-table").innerHTML = databaseData.recentRecords.map((record) => `<tr><td><strong>${record.title}</strong><span>${record.detail}</span></td><td>${record.module}</td><td>${record.owner}</td><td><span class="status status--${record.tone}">${record.status}</span></td><td>${record.date}</td></tr>`).join("");

  document.querySelector("#people-total").textContent = metrics.employees;
  document.querySelector("#people-active").textContent = metrics.activeEmployees;
  document.querySelector("#people-departments").textContent = metrics.departments;
  renderDistribution(databaseData.insights.employeeStatus, "#status-list", "#status-donut");
  renderHorizontalBars(databaseData.insights.employeeGender, "#gender-bars");
  document.querySelector("#people-cards").innerHTML = databaseData.insights.employees.map((person) => `<button type="button" class="person-row" data-person="${person.name}"><span>${person.initials}</span><div><strong>${person.name}</strong><small>${person.role}</small></div><b>${person.status}</b></button>`).join("");

  document.querySelector("#finance-sales").textContent = formatMoney(metrics.totalSales);
  document.querySelector("#finance-payments").textContent = formatMoney(metrics.totalPayments);
  document.querySelector("#finance-outstanding").textContent = formatMoney(metrics.outstanding);
  document.querySelector("#finance-rate").textContent = `${collectionRate.toFixed(1)}% collected`;
  document.querySelector("#collection-rate-label").textContent = `${collectionRate.toFixed(1)}%`;
  document.querySelector("#collection-gap").textContent = formatMoney(metrics.outstanding);
  document.querySelector("#collection-donut").style.background = `conic-gradient(var(--gold) 0 ${Math.min(collectionRate, 100)}%, rgba(7,62,87,.1) ${Math.min(collectionRate, 100)}% 100%)`;
  const monthlyMaximum = Math.max(...databaseData.insights.monthlyPayments.map((item) => item.value));
  document.querySelector("#monthly-payment-chart").innerHTML = databaseData.insights.monthlyPayments.map((item) => `<div title="${item.label}: ${formatMoney(item.value)}"><strong>${formatMoney(item.value)}</strong><i style="height:${Math.max(10, (item.value / monthlyMaximum) * 100)}%"></i><span>${item.label}</span></div>`).join("");
  document.querySelector("#finance-table").innerHTML = databaseData.recentRecords.filter((record) => record.module === "Payments").map((record) => {
    const [transaction, amount] = record.detail.split(" - ");
    return `<tr><td><strong>${record.title}</strong></td><td>${transaction}</td><td>${amount}</td><td><span class="status status--success">${record.status}</span></td><td>${record.date}</td></tr>`;
  }).join("");

  document.querySelectorAll(".person-row").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.person} quick view selected.`)));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function closeMobileNavigation() {
  sidebar.classList.remove("is-open");
  menuButton.setAttribute("aria-expanded", "false");
}

function setSidebarExpanded(expanded) {
  sidebar.classList.toggle("is-expanded", expanded);
  dashboardShell.classList.toggle("sidebar-expanded", expanded);
  sidebarToggle.setAttribute("aria-expanded", String(expanded));
  sidebarToggle.setAttribute("aria-label", expanded ? "Collapse navigation" : "Expand navigation");
  window.localStorage.setItem(sidebarPreferenceKey, String(expanded));
}

setSidebarExpanded(window.localStorage.getItem(sidebarPreferenceKey) === "true");

document.querySelectorAll(".module-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".module-tabs button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
      item.setAttribute("aria-selected", String(item === button));
    });
    const selected = button.dataset.tab;
    document.querySelectorAll("[data-view]").forEach((view) => { view.hidden = view.dataset.view !== selected; });
  });
});

document.querySelectorAll(".quick-action").forEach(button => button.addEventListener("click", () => {
 const route = {"Add customer":"customers/?action=add","Record sale":"sales/?action=add","Approve users":"user-management/","Open reports":"reports/"}[button.dataset.action];
 if(route) window.HopeNavigation.go("../"+route.replace('/?', '/index.html?').replace(/\/$/, '/index.html'));
}));
document.querySelectorAll(".card-heading button").forEach((button) => {
  button.addEventListener("click", () => showToast(`${button.closest(".metric-card").querySelector(".card-heading > span:nth-child(2)").textContent} options opened.`));
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  document.querySelectorAll("tbody tr").forEach((row) => {
    row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query);
  });
});

document.querySelector("#chart-period").addEventListener("change", (event) => {
  showToast(`Sales chart changed to ${event.target.value.toLowerCase()}. Live data integration is pending.`);
});

document.querySelector("#notifications-button").addEventListener("click", () => window.HopeNavigation.go("../user-management/index.html"));
document.querySelector("#settings-button").onclick=() => window.HopeNavigation.go("../administrator/index.html");
document.querySelector("#logout-button").onclick=async () => {
 await fetch("/api/auth/logout",{method:"POST",headers:{"content-type":"application/json"}}); location.assign("../../index.html");
};
document.querySelector("#view-all").addEventListener("click", () => window.HopeNavigation.go("../administrator/index.html"));
document.querySelector("#profile-button").onclick=() => {
  const popover = document.querySelector("#profile-popover");
  popover.hidden = !popover.hidden;
};

document.querySelector(".workspace").addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileNavigation();
});

renderDatabaseSnapshot();

const requestedView = new URLSearchParams(window.location.search).get("view");
if (requestedView) showToast(`${requestedView === "user-management" ? "User Management" : "Administrator"} workspace is awaiting backend integration.`);

window.refreshHopeDashboard = data => { databaseData=data; renderDatabaseSnapshot(); };

})();
