/* The application reads and writes through the session-authenticated backend.
   No Supabase secret or seeded business rows are shipped to the browser. */
(() => {
  const lifecycle = new AbortController();
  document.addEventListener("hope:leave",()=>{lifecycle.abort();clearInterval(timer);version++;},{once:true});
  const app = document.querySelector("#app");
  const module = document.body.dataset.module || "dashboard";
  const rowCache=new Map();
  let initialRecords, listAbort, searchTimer, sortField=null, descending=false, extraFilters={}, auxiliaryRows=[], auxiliaryTarget=null;
  let schema,
    user,
    view,
    rows = [],
    count = 0,
    page = 0,
    filter = "active",
    query = "",
    timer,
    loading = false,
    queued = false,
    version = 0,
    lastRows = "",
    opener = null,
    lastReportUrl = null,
    restoreKey = null;
  const h = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const singular = (key) =>
    ({
      customers: "customer",
      products: "product",
      prices: "price",
      employees: "employee",
      departments: "department",
      jobs: "job",
      "job-history": "job history entry",
      sales: "sale",
      "sale-details": "sale item",
      payments: "payment",
      users: "user",
    })[key] || key;
  const fieldLabel = (key) =>
    schema.fields[key]?.[0] ||
    {
      is_deleted: "Record status",
      stamp: "Last change",
      current_price: "Current price",
      price_effective_date: "Price effective date",
      total: "Sale total",
      paid: "Paid",
      balance: "Balance",
      name: "Name",
      email: "Email",
      role: "Role",
      status: "Account status",
    }[key] ||
    key.replaceAll("_", " ");
  const label = (key) => schema?.labels[key] || key;
  const can = (key) =>
    user?.role === "superadmin" ||
    (user?.rights?.[key.split(".")[0] + ".view"] === true &&
      user?.rights?.[key] === true);
  const admin = () => ["admin", "superadmin"].includes(user?.role);
  const cfg = () => schema.resources[view];
  const permitted = (operation) =>
    view === "users"
      ? admin()
      : cfg() && can(`${cfg().module}.${cfg().actions[operation]}`);
  const rowKey = (row) =>
    view === "users"
      ? row.id
      : cfg()
          .pk.map((k) =>
            schema.fields[k]?.[1] === "date"
              ? String(row[k]).slice(0, 10)
              : row[k],
          )
          .join("~");
  const urlFor = (key) =>
    view === "users"
      ? `/api/admin/users/${encodeURIComponent(key)}`
      : `/api/${view}/${encodeURIComponent(key)}`;
  const money = (value) =>
    value === null || value === undefined
      ? "—"
      : new Intl.NumberFormat("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(Number(value));
  async function request(url, options = {}) {
    let response;
    for(let attempt=0;attempt<2;attempt++)try{response = await fetch(url, {
      credentials: "same-origin",
      signal: lifecycle.signal,
      ...options,
      headers: { "content-type": "application/json", ...options.headers },
    });break;}catch(error){if(lifecycle.signal.aborted||options.signal?.aborted||error.name==="AbortError")throw error;if(attempt||options.method&&options.method!=="GET")throw new Error("Connection interrupted. Automatic updates will retry.");await new Promise(resolve=>setTimeout(resolve,250));}
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.message || "The request failed.");
      error.status = response.status;
      if (response.status === 401) location.assign("/UI-UX/index.html");
      throw error;
    }
    return result;
  }
  const send = (url, method, data, row) =>
    request(url, {
      method,
      body: data === undefined ? undefined : JSON.stringify(data),
      headers: row?.updated_at
        ? { "if-match": JSON.stringify(row.updated_at) }
        : {},
    });
  function notice(text, error = false) {
    const el = document.querySelector("#live-status");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("live-error", error);
  }
  async function shell() {
    const presentation = ({"customers":{"eyebrow":"Customer management","description":"Manage customer records, addresses, and payment terms."},"products":{"eyebrow":"Product management","description":"Maintain the product catalog and open each product's price history."},"human-resources":{"eyebrow":"People and organization","description":"Review employee records and open job history without exposing it in navigation."},"sales":{"eyebrow":"Sales management","description":"Review transaction headers and open their detail lines and payments."},"user-management":{"eyebrow":"Administration","description":"Review users and arrange permission-based roles."}})[module] || {eyebrow:"Administrator workspace",description:""};
    const links = [
      ["dashboard", "Dashboard", true],
      ["customers", "Customers", can("customers.view")],
      ["products", "Products", can("products.view")],
      ["human-resources", "Human Resources", can("hr.view")],
      ["sales", "Sales", can("sales.view")],
      ["reports", "Reports", can("reports.view")],
      ["user-management", "User Management", admin()],
      ["administrator", "System settings", user.role === "superadmin"],
    ];
    const originalSidebar = window.hopeSidebarTemplate || await (await fetch("/UI-UX/shared/utilities/original-sidebar.html",{signal:lifecycle.signal})).text();
    window.hopeSidebarTemplate=originalSidebar;
    if(lifecycle.signal.aborted)return;
    const template=document.createElement("template");
    template.innerHTML = `${originalSidebar}<section class="workspace module-workspace"><header class="topbar module-topbar"><div><p class="eyebrow">${h(presentation.eyebrow)}</p><h1>${h(module === "dashboard" ? "Dashboard" : module === "human-resources" ? "Human Resources" : module === "user-management" ? "User Management" : module === "administrator" ? "Administration" : label(module))}</h1><p class="subtitle">${h(presentation.description)}</p></div><div class="module-topbar-actions"><button id="live-menu" class="icon-button mobile-menu" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button><button id="live-add" class="module-primary" type="button" hidden>Add record</button></div></header><div class="entity-tabs" id="live-tabs" role="tablist" aria-label="Views"></div><div class="module-toolbar" id="live-toolbar"><label class="live-filter">Records<select id="live-filter"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select></label><button type="button" class="dialog-secondary" id="live-filter-toggle" aria-expanded="false" aria-controls="live-filters">Filter</button><label class="live-filter">Sort by<select id="live-sort-field" aria-label="Sort column"></select></label><button type="button" class="dialog-secondary" id="live-sort-order" aria-label="Sort order: ascending">Asc</button><label class="module-search"><span class="sr-only">Search records</span><input id="live-search" type="search" placeholder="Search records" aria-label="Search records"></label></div><div id="live-filters" class="live-table-filters" hidden aria-label="Table filters"></div><p id="live-status" role="status" aria-live="polite">Loading records…</p><div id="live-content"></div></section><dialog id="live-dialog" class="record-dialog record-dialog--wide" aria-labelledby="live-dialog-title"></dialog><div id="live-context" class="live-context" role="menu" hidden></div>`;
    const existingSidebar=app.querySelector("#sidebar");
    app.querySelectorAll(":scope > :not(#sidebar)").forEach(el=>el.remove());
    if(existingSidebar)template.content.querySelector("#sidebar").remove();
    app.append(template.content);
    // Restore Natalia's original navigation markup; retain only live access filtering and handlers.
    const routeKeys = {Dashboard:"dashboard",Customers:"customers",Products:"products","Human Resources":"human-resources",Sales:"sales","User Management":"user-management"};
    document.querySelectorAll(".sidebar-nav a").forEach(a => {
      const key=routeKeys[a.getAttribute("aria-label")]; const permittedLink=links.find(l=>l[0]===key);
      if(!permittedLink?.[2]) {a.remove();return;}
      a.href=`../${key}/index.html`; a.classList.toggle("is-active",key===module); a.removeAttribute("aria-current");
      if(key===module)a.setAttribute("aria-current","page");
    });
    const expanded=localStorage.getItem("hopeSidebarExpanded")==="true";
    function expand(value){document.querySelector("#sidebar").classList.toggle("is-expanded",value);app.classList.toggle("sidebar-expanded",value);const toggle=document.querySelector("#sidebar-toggle");toggle.setAttribute("aria-expanded",String(value));toggle.setAttribute("aria-label",value?"Collapse navigation":"Expand navigation");localStorage.setItem("hopeSidebarExpanded",String(value));}
    expand(expanded);document.querySelector("#sidebar-toggle").onclick=null;
    document.querySelector("#logout-button").id="live-logout";
    document.querySelector("#settings-button").onclick=()=>window.HopeNavigation.go("../administrator/index.html");
    document.querySelector(".profile-copy strong").textContent=user.name;
    document.querySelector(".profile-copy small").textContent=user.role;
    document.querySelector(".avatar").textContent=user.name.split(/\s+/).map(n=>n[0]).slice(0,2).join("");
    document.querySelector("#profile-button").onclick=()=>{const old=document.querySelector("#live-profile-popover");if(old){old.remove();return;}const pop=document.createElement("div");pop.id="live-profile-popover";pop.className="module-profile-popover";pop.innerHTML=`<strong>${h(user.name)}</strong><span>${h(user.username||user.email)}</span>${user.email?'<a href="/api/auth/google?link=1">Link Google</a>':''}`;app.append(pop);};
    app.setAttribute("aria-busy", "false");
    document.querySelector("#live-menu").onclick = (e) => {
      const open = document
        .querySelector("#sidebar")
        .classList.toggle("is-open");
      e.currentTarget.setAttribute("aria-expanded", String(open));
    };
    document.querySelector("#live-logout").onclick = async () => {
      try {
        await send("/api/auth/logout", "POST");
        location.assign("/UI-UX/index.html");
      } catch (e) {
        notice(e.message, true);
      }
    };
    document.querySelector("#live-add").onclick = () => openForm();
    document.querySelector("#live-filter").closest("label").hidden = !admin();
    document.querySelector("#live-filter").onchange = (e) => {filter=e.target.value;refreshTable();};
    document.querySelector("#live-filter-toggle").onclick=()=>{const panel=document.querySelector("#live-filters");panel.hidden=!panel.hidden;document.querySelector("#live-filter-toggle").setAttribute("aria-expanded",String(!panel.hidden));};
    document.querySelector("#live-sort-field").onchange=e=>{sortField=e.target.value;refreshTable();};
    document.querySelector("#live-sort-order").onclick=()=>{descending=!descending;updateSortButton();refreshTable();};
    document.querySelector("#live-search").oninput = (e) => {
      query = e.target.value;
      clearTimeout(searchTimer);searchTimer=setTimeout(refreshTable,250);
    };
    const views = (schema.groups[module] || []).filter((key) => {
      const r = schema.resources[key];
      return !r || can(`${r.module}.${r.read || "view"}`);
    });
    const requestedView=new URLSearchParams(location.search).get("view");
    view = views.includes(requestedView)?requestedView:views[0];
    document.querySelector("#live-tabs").innerHTML = views
      .map(
        (key) =>
          `<button type="button" role="tab" data-view="${key}" aria-selected="${key === view}" class="${key === view ? "is-active" : ""}">${h(label(key))}</button>`,
      )
      .join("");
    document.querySelector("#live-tabs").onclick = (e) => {
      const button = e.target.closest("[data-view]");
      if (!button) return;
      listAbort?.abort();loading=false;queued=false;version++;
      view = button.dataset.view;sortField=null;descending=false;extraFilters={};auxiliaryRows=[];auxiliaryTarget=null;
      page = 0;
      query = "";
      document.querySelector("#live-search").value = "";
      lastRows = "";
      configureTools();
      document.querySelectorAll("[data-view]").forEach((b) => {
        b.classList.toggle("is-active", b === button);
        b.setAttribute("aria-selected", String(b === button));
      });
      load(true);
    };
    configureTools();
    const dialog = document.querySelector("#live-dialog");
    dialog.addEventListener("close", () => {
      dialog.replaceChildren();
      if (opener?.isConnected && !opener.closest("[hidden]")) opener.focus();
      else {
        const target = [...document.querySelectorAll("[data-row]")].find(
          (tr) => tr.dataset.recordKey === restoreKey,
        );
        (target || document.querySelector("#live-search")).focus();
      }
      opener = null;
    });
    document.addEventListener(
      "click",
      () => {const menu=document.querySelector("#live-context");if(menu)menu.hidden=true;},
      {signal:lifecycle.signal},
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelector("#live-context").hidden = true;
        document.querySelector("#sidebar").classList.remove("is-open");
      }
    }, {signal:lifecycle.signal});
  }
  function updateSortButton(){const button=document.querySelector("#live-sort-order");button.textContent=descending?"Desc \u2193":"Asc \u2191";button.setAttribute("aria-label","Sort order: "+(descending?"descending":"ascending"));}
  function tableParams(){const params=new URLSearchParams({status:filter,limit:"50",offset:String(page*50),sort:sortField||cfg()?.pk[0]||"name",direction:descending?"desc":"asc"});if(query.trim())params.set("q",query.trim());for(const [key,value]of Object.entries(extraFilters))if(value!=="")params.set("f_"+key,value);return params;}
  function refreshTable(){
    clearTimeout(searchTimer);page=0;initialRecords=null;
    if(view==="reports"||view==="audit-log"){paintAuxRows();return;}
    listAbort?.abort();loading=false;queued=false;version++;load(true);
  }
  function filterSpecs(fields=[]){return schema.tableFilters?.[view]||fields.filter(f=>!['new_values','old_values'].includes(f)).map(field=>({field,type:schema.fields[field]?.[1]==="number"||typeof auxiliaryRows.find(r=>r[field]!=null)?.[field]==="number"?"number":schema.fields[field]?.[1]==="date"?"date":"text"}));}
  function configureTools(auxFields){
    const fields=auxFields?.filter(f=>!["new_values","old_values"].includes(f))|| (view==="users"?["name","username","email","role","status","created_at"]:cfg()?[...new Set([...cfg().pk,...cfg().fields])]:[]);
    if(!fields.includes(sortField))sortField=view==="users"?"name":fields[0];
    const select=document.querySelector("#live-sort-field");select.innerHTML=fields.map(f=>`<option value="${h(f)}">${h(fieldLabel(f))}</option>`).join("");if(sortField)select.value=sortField;
    updateSortButton();
    const specs=filterSpecs(fields),panel=document.querySelector("#live-filters");
    const toggle=document.querySelector("#live-filter-toggle");const selectedCount=Object.values(extraFilters).filter(Boolean).length;toggle.textContent=selectedCount?`Filter (${selectedCount})`:"Filter";toggle.disabled=!specs.length;
    select.disabled=!fields.length;document.querySelector("#live-sort-order").disabled=!fields.length;
    if(!specs.length){panel.hidden=true;toggle.setAttribute("aria-expanded","false");}
    panel.innerHTML=specs.map(f=>{
      const name=h(f.field),title=h(f.field==="employment"?"Employment":fieldLabel(f.field));
      if(f.type==="select")return `<label class="field"><span>${title}</span><select data-table-filter="${name}"><option value="">All</option>${f.options.map(v=>`<option value="${h(v)}">${h(v)}</option>`).join("")}</select></label>`;
      if(["date","number"].includes(f.type))return `<fieldset class="live-filter-range"><legend>${title}</legend><label>From<input type="${f.type}" ${f.type==="number"?'step="any"':""} data-table-filter="${name}_from"></label><label>To<input type="${f.type}" ${f.type==="number"?'step="any"':""} data-table-filter="${name}_to"></label></fieldset>`;
      return `<label class="field"><span>${title}</span><input data-table-filter="${name}" placeholder="Contains..."></label>`;
    }).join("")+`<button type="button" class="dialog-secondary" id="live-filter-clear">Clear filters</button>`;
    const changed=()=>{extraFilters=Object.fromEntries([...panel.querySelectorAll('[data-table-filter]')].map(el=>[el.dataset.tableFilter,el.value]));const count=Object.values(extraFilters).filter(Boolean).length;document.querySelector('#live-filter-toggle').textContent=count?`Filter (${count})`:"Filter";clearTimeout(searchTimer);searchTimer=setTimeout(refreshTable,250);};
    panel.querySelectorAll('[data-table-filter]').forEach(el=>{el.value=extraFilters[el.dataset.tableFilter]||"";el.oninput=changed;el.onchange=changed;});
    panel.querySelector('#live-filter-clear').onclick=()=>{panel.querySelectorAll('[data-table-filter]').forEach(el=>el.value="");changed();};
    document.querySelector('#live-filter').closest('label').hidden=!admin()||view==='reports'||view==='audit-log';
  }
  function showAuxRows(data,target){auxiliaryRows=data;auxiliaryTarget=target;const fields=Object.keys(data[0]||{}).filter(f=>!['password_hash','rights'].includes(f));configureTools(fields);document.querySelector('#live-toolbar').hidden=false;paintAuxRows();}
  function paintAuxRows(){
    if(!auxiliaryTarget)return;
    const fields=Object.keys(auxiliaryRows[0]||{}).filter(f=>!['password_hash','rights'].includes(f));
    const data=auxiliaryRows.filter(row=>{
      if(query&&!Object.values(row).some(v=>String(v??'').toLowerCase().includes(query.toLowerCase())))return false;
      for(const spec of filterSpecs(fields)){
        const v=extraFilters[spec.field],value=row[spec.field];
        if(v&&(spec.type==='select'?String(value)!==v:!String(value??'').toLowerCase().includes(v.toLowerCase())))return false;
        const from=extraFilters[spec.field+'_from'],to=extraFilters[spec.field+'_to'];
        const comparable=spec.type==='number'?Number(value):String(value??'').slice(0,10);
        if((from||to)&&(value==null||spec.type==='number'&&!Number.isFinite(comparable)))return false;
        if(from&&comparable<(spec.type==='number'?Number(from):from)||to&&comparable>(spec.type==='number'?Number(to):to))return false;
      }return true;
    }).sort((a,b)=>{const av=a[sortField],bv=b[sortField];const order=typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),undefined,{numeric:true,sensitivity:'base'});return descending?-order:order;});
    const markup=tableRows(data,fields.length?fields:['result']);document.querySelector(auxiliaryTarget).innerHTML=auxiliaryTarget==='#live-content'?'<article class="panel records-panel">'+markup+'</article>':markup;
  }
  function cell(value, field) {
    if (value === null || value === undefined) return "—";
    if (
      schema.fields[field]?.[1] === "date" ||
      field === "price_effective_date"
    )
      return String(value).slice(0, 10);
    if (typeof value === "object") return JSON.stringify(value);
    if (
      [
        "current_price",
        "unitprice",
        "salary",
        "amount",
        "quantity",
        "total",
        "paid",
        "balance",
        "line_total",
      ].includes(field)
    )
      return money(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }
  function recordLink(link, row) {
    const resource=schema.resources[link.resource];
    if(!resource || !can(`${resource.module}.${resource.read || "view"}`))return null;
    const group=Object.keys(schema.groups).find(key=>schema.groups[key].includes(link.resource));
    if(!group)return null;
    const params=new URLSearchParams({view:link.resource});
    if(link.key){if(link.key.some(k=>row[k]===null||row[k]===undefined))return null;params.set("record",link.key.map(k=>schema.fields[k]?.[1]==="date"?String(row[k]).slice(0,10):row[k]).join("~"));}
    else for(const field of link.filter||[]){if(row[field]===null||row[field]===undefined)return null;params.set(field,row[field]);}
    return `../${group}/index.html?${params}`;
  }
  function cellMarkup(row, field) {
    const text=h(field==="is_deleted"?(row[field]?"Inactive":"Active"):cell(row[field],field));
    if(row[field]===null||row[field]===undefined)return text;
    const relation=schema.cellLinks?.[view]?.[field];
    const href=relation&&recordLink(relation,row);
    return href?`<a class="record-action" data-record-link href="${h(href)}" title="Open ${h(label(relation.resource))}">${text}</a>`:text;
  }
  function bindRecordLinks(root){
    root.querySelectorAll("a[data-record-link]").forEach(link=>{
      link.onclick=event=>{
        event.stopPropagation();
        if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
        event.preventDefault();
        if(link.href===location.href)return;
        const dialog=link.closest("dialog");if(dialog?.open)dialog.close();
        window.HopeNavigation.go(link.href);
      };
      link.onkeydown=event=>event.stopPropagation();
    });
  }
  function tableRows(data, fields, interactive = false) {
    return `<div class="records-scroll"><table class="records-table"><thead><tr>${fields.map((f) => `<th scope="col">${h(fieldLabel(f))}</th>`).join("")}</tr></thead><tbody>${data.length ? data.map((row, i) => `<tr ${interactive ? `data-row="${i}" tabindex="0"` : ""} aria-label="Open ${h(row.name || row.custname || row.description || row.transno || row[fields[0]])}">${fields.map((f) => `<td>${cellMarkup(row, f)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${fields.length}" class="record-empty">${query ? "No matching records on this page." : "No records yet."}</td></tr>`}</tbody></table></div>`;
  }
  function paintRows() {
    if (!cfg() && view !== "users") return;
    const filtered = rows;
    const fields =
      view === "users"
        ? ["name", "email", "role", "status"]
        : [
            ...new Set([
              ...cfg().pk,
              ...cfg().fields,
              ...(view === "products"
                ? ["current_price", "price_effective_date"]
                : view === "sales"
                  ? ["total", "paid", "balance"]
                  : []),
            ]),
          ].concat(admin() ? ["is_deleted", "stamp"] : []);
    document.querySelector("#live-content").innerHTML =
      `<article class="panel records-panel"><div class="records-meta"><strong>${h(label(view))}</strong><span>${count} saved record${count === 1 ? "" : "s"}</span></div>${tableRows(filtered, fields, true)}<footer class="records-footer"><span>${rows.length ? `Page ${page + 1} · ${filtered.length} shown` : "No saved records"} · Refreshes automatically</span><div class="record-pages"><button type="button" id="live-prev" aria-label="Previous page" ${page === 0 ? "disabled" : ""}>‹</button><button type="button" class="is-active" aria-current="page">${page + 1}</button><button type="button" id="live-next" aria-label="Next page" ${(page + 1) * 50 >= count ? "disabled" : ""}>›</button></div></footer></article>`;
    bindRecordLinks(document.querySelector("#live-content"));
    document.querySelector("#live-prev").onclick = () => {
      page--;
      load(true);
    };
    document.querySelector("#live-next").onclick = () => {
      page++;
      load(true);
    };
    document.querySelectorAll("[data-row]").forEach((tr) => {
      const row = filtered[Number(tr.dataset.row)];
      tr.dataset.recordKey = rowKey(row);
      tr.onclick = () => openRecord(row);
      tr.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          openRecord(row);
        }
        if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
          e.preventDefault();
          context(
            row,
            tr.getBoundingClientRect().left,
            tr.getBoundingClientRect().top,
          );
        }
      };
      tr.oncontextmenu = (e) => {
        e.preventDefault();
        context(row, e.clientX, e.clientY);
      };
    });
    const add = document.querySelector("#live-add");
    add.hidden = !permitted(0);
    add.textContent = `+ Add ${singular(view)}`;
  }
  function context(row, x, y) {
    const menu = document.querySelector("#live-context");
    menu.innerHTML =
      '<button type="button" role="menuitem">Open record</button>';
    menu.style.left = Math.min(x, innerWidth - 190) + "px";
    menu.style.top = Math.min(y, innerHeight - 60) + "px";
    menu.hidden = false;
    menu.querySelector("button").onclick = () => openRecord(row);
    menu.querySelector("button").focus();
  }
  async function load(force = false) {
    if (lifecycle.signal.aborted) return;
    if (loading) {
      if (force) queued = true;
      return;
    }
    if (!force && document.hidden) return;
    loading = true;
    const requestVersion = ++version;
    const requestedView = view;
    try {
      if (module === "dashboard") {
        const result = await request("/api/dashboard");
        document.querySelector("#live-toolbar").hidden = true;
        document.querySelector("#live-add").hidden = true;
        document.querySelector("#live-content").innerHTML =
          `<section class="module-stats">${Object.entries(result.data.counts)
            .map(
              ([k, v]) =>
                `<article class="module-stat"><small>${h(label(k))}</small><strong>${v}</strong><span>Active saved records</span></article>`,
            )
            .join(
              "",
            )}</section><article class="panel live-welcome"><h2>Welcome, ${h(user.name)}</h2><p>Select a module to view or update its records.</p></article>`;
      } else if (view === "reports") {
        if (force) renderReports();
        else if (lastReportUrl) {
          const result = await request(lastReportUrl);
          showAuxRows(result.data,"#report-result");
        }
      } else if (view === "settings" || view === "audit-log") {
        await loadAdministration();
      } else {
        document.querySelector("#live-toolbar").hidden = false;
        const endpoint =
          view === "users"
            ? "/api/admin/users?"+tableParams()
            : (()=>{const params=tableParams();const route=new URLSearchParams(location.search);for(const field of schema.listFilters?.[view]||[]){if(route.has(field))params.set(field,route.get(field));}return `/api/${view}?${params}`;})();
        const cached=rowCache.get(endpoint);
        if(force && cached){rows=cached.data;count=cached.count??rows.length;paintRows();notice("Checking for updates�");}
        listAbort=new AbortController();
        const result = initialRecords?.view===view ? initialRecords.result : await request(endpoint,{signal:AbortSignal.any([lifecycle.signal,listAbort.signal])});
        initialRecords=null;
        rowCache.set(endpoint,result);
        if (requestVersion !== version || requestedView !== view) return;
        const next = JSON.stringify(result.data);
        rows = result.data;
        count = result.count ?? rows.length;
        if (force || next !== lastRows) {
          lastRows = next;
          paintRows();
        }
      }
      notice(
        "Up to date · " +
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
      );
      const dialog = document.querySelector("#live-dialog");
      if (dialog.open) {
        const fieldset = dialog.querySelector("[data-record-key]");
        const current = rows.find(
          (r) => rowKey(r) === fieldset?.dataset.recordKey,
        );
        if (
          current &&
          fieldset.dataset.recordVersion &&
          current.updated_at !== fieldset.dataset.recordVersion
        ) {
          dialog.querySelector(".live-dialog-notice").textContent =
            "This record changed elsewhere. Your draft is intact; reload the record before saving.";
        }
        await refreshChoices(dialog);
      }
    } catch (error) {
      if(lifecycle.signal.aborted||error.name==="AbortError")return;
      if(error.status===401||error.status===403){rowCache.clear();rows=[];document.querySelector("#live-content").replaceChildren();}
      notice(error.message, true);
      if (!rows.length && !document.querySelector("#live-dialog").open)
        document.querySelector("#live-content").innerHTML =
          '<article class="panel live-welcome"><p>Records could not be loaded.</p></article>';
    } finally {
      if(requestVersion!==version)return;
      loading = false;
      if (queued) {
        queued = false;
        load(true);
      }
    }
  }
  function showDialog(title, body, actions = "") {
    const d = document.querySelector("#live-dialog");
    if (!d.open) opener = document.activeElement;
    d.innerHTML = `<form id="live-form"><header class="dialog-header"><div><p class="eyebrow">${h(label(view))}</p><h2 id="live-dialog-title">${h(title)}</h2></div><button type="button" class="dialog-close" aria-label="Close dialog">×</button></header><p class="live-dialog-notice" role="status"></p><div class="live-dialog-body">${body}</div><footer class="dialog-actions"><button type="button" class="dialog-secondary" data-close>Cancel</button>${actions}</footer></form>`;
    d.querySelector(".dialog-close").onclick = () => d.close();
    d.querySelector("[data-close]").onclick = () => d.close();
    d.querySelector("form").onsubmit = event => event.preventDefault();
    if (!d.open) d.showModal();
    return d;
  }
  function recordDescription(row) {
    return view === "users"
      ? row.name
      : row.custname ||
          row.description ||
          row.firstname ||
          row.transno ||
          rowKey(row);
  }
  async function openRecord(row) {
    restoreKey = rowKey(row);
    const resource = view;
    try {
      const latest = (
        await request(
          view === "users" ? "/api/admin/users?status=all&limit=200" : urlFor(rowKey(row)),
        )
      ).data;
      row = Array.isArray(latest)
        ? latest.find((r) => r.id === row.id)
        : latest;
      if (!row) throw new Error("This record is no longer available.");
    } catch (e) {
      notice(e.message, true);
      return;
    }
    if (resource !== view) return;
    const fields =
      view === "users"
        ? ["name", "email", "role", "status"]
        : [
            ...new Set([
              ...cfg().pk,
              ...cfg().fields,
              ...(view === "products"
                ? ["current_price", "price_effective_date"]
                : view === "sales"
                  ? ["total", "paid", "balance"]
                  : []),
            ]),
          ].concat(admin() ? ["is_deleted", "stamp"] : []);
    const editable = permitted(1) && !(view === "users" && (row.id === user.id || row.is_deleted));
    const actions = `${editable ? '<button type="button" class="module-primary" id="live-edit">Edit</button>' : ""}${view === "users" && row.id !== user.id && !row.is_deleted ? '<button type="button" class="dialog-secondary" id="live-rights">Assign rights</button><button type="button" class="dialog-secondary" id="live-invite">Send setup link</button>' : ""}${view !== "users" && permitted(2) ? `<button type="button" class="dialog-secondary live-danger" id="live-delete">${row.is_deleted ? "Restore" : "Make inactive"}</button>` : ""}`;
    const d = showDialog(
      recordDescription(row),
      `<dl class="live-record">${fields.map((f) => `<div><dt>${h(fieldLabel(f))}</dt><dd>${cellMarkup(row, f)}</dd></div>`).join("")}</dl>`,
      actions,
    );
    const related=(schema.related?.[view]||[]).map(link=>{const href=recordLink(link,row);return href?`<a class="record-action" data-record-link href="${h(href)}">${h(label(link.resource))}</a>`:"";}).filter(Boolean);
    if(related.length){const links=document.createElement("p");links.innerHTML=related.join(" � ");d.querySelector(".live-dialog-body").append(links);}
    bindRecordLinks(d);
    d.querySelector("form").onsubmit = (e) => e.preventDefault();
    d.querySelector("#live-edit")?.addEventListener("click", () =>
      openForm(row),
    );
    d.querySelector("#live-rights")?.addEventListener("click", () =>
      openRights(row),
    );
    d.querySelector("#live-invite")?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      try {
        const r = await send(urlFor(row.id) + "/invite", "POST", {});
        d.querySelector(".live-dialog-notice").textContent = r.message;
      } catch (error) {
        d.querySelector(".live-dialog-notice").textContent = error.message;
      } finally {
        e.currentTarget.disabled = false;
      }
    });
    d.querySelector("#live-delete")?.addEventListener("click", () => {
      const deleted = !row.is_deleted;
      d.querySelector(".live-dialog-notice").textContent =
        `${deleted ? "Make" : "Restore"} ${recordDescription(row)} ${deleted ? "inactive? Related active records may prevent this." : "to active records?"}`;
      const b = d.querySelector("#live-delete");
      b.textContent = deleted ? "Confirm make inactive" : "Confirm restore";
      b.onclick = async () => {
        b.disabled = true;
        try {
          await send(
            urlFor(rowKey(row)) + (deleted ? "" : "/restore"),
            deleted ? "DELETE" : "POST",
            undefined,
            row,
          );
          d.close();
          await load(true);
        } catch (e) {
          d.querySelector(".live-dialog-notice").textContent = e.message;
          b.disabled = false;
        }
      };
    });
  }
  function input(field, row, editing) {
    if(!editing && schema.autoCodes?.[view]?.field===field)return `<label class="field"><span>${h(fieldLabel(field))}</span><input name="${field}" value="" placeholder="Generating code�" readonly data-auto-code><small>Assigned automatically when saved.</small></label>`;
    const meta = schema.fields[field],
      foreign = schema.lookups[view]?.[field];
    const immutable = editing && cfg().pk.includes(field);
    const required =
      cfg().pk.includes(field) ||
      !["birthdate", "gender", "sepdate", "deptcode"].includes(field);
    const attrs = `name="${field}" ${required ? "required" : ""} ${immutable ? "disabled" : ""}`;
    const raw = row?.[field] ?? "";
    const value = meta[1] === "date" ? String(raw).slice(0, 10) : raw;
    let control;
    if (foreign && !immutable)
      control = `<select ${attrs} data-lookup="${foreign}" data-purpose="${view}" data-selected="${h(value)}"><option value="">Loading choices…</option></select>`;
    else if (meta[1] === "select")
      control = `<select ${attrs}><option value="">Select ${h(meta[0].toLowerCase())}</option>${meta[2].map((v) => `<option value="${v}" ${v === value ? "selected" : ""}>${h(v === "30D" ? "30 days" : v === "45D" ? "45 days" : v)}</option>`).join("")}</select>`;
    else
      control = `<input ${attrs} type="${meta[1]}" value="${h(value)}" ${typeof meta[2] === "number" ? `maxlength="${meta[2]}"` : ""} ${meta[1] === "number" ? 'min="0" step="0.01"' : ""}>`;
    return `<label class="field"><span>${h(meta[0])}${required ? "" : " (optional)"}</span>${control}</label>`;
  }
  async function lookup(name, purpose) {
    let result = [],
      offset = 0;
    for (;;) {
      const r = await request(
        `/api/lookups/${name}?for=${purpose}&offset=${offset}`,
      );
      result.push(...r.data);
      if (r.data.length < 200 || result.length >= r.count) break;
      offset += 200;
    }
    return result;
  }
  function optionLabel(name, row) {
    return name === "customers"
      ? `${row.custno} · ${row.custname}`
      : name === "employees"
        ? `${row.empno} · ${row.firstname} ${row.lastname}`
        : name === "products"
          ? `${row.prodcode} · ${row.description}`
          : name === "departments"
            ? `${row.deptcode} · ${row.deptname}`
            : name === "jobs"
              ? `${row.jobcode} · ${row.jobdesc}`
              : `${row.transno} · ${String(row.salesdate).slice(0, 10)}`;
  }
  async function refreshChoices(d) {
    const nodes = [...d.querySelectorAll("select[data-lookup]")];
    const cache = new Map();
    for (const select of nodes) {
      if (!select.isConnected) continue;
      const key = select.dataset.lookup + "|" + select.dataset.purpose;
      if (!cache.has(key))
        cache.set(key, lookup(select.dataset.lookup, select.dataset.purpose));
      const data = await cache.get(key);
      if (!select.isConnected) continue;
      const value = select.dataset.loaded
        ? select.value
        : select.dataset.selected || "";
      const name = select.dataset.lookup;
      const pk = schema.resources[name].pk[0];
      const old = select.innerHTML;
      const options =
        `<option value="">${data.length ? "Select a record" : "No active records available"}</option>` +
        data
          .map(
            (row) =>
              `<option value="${h(row[pk])}">${h(optionLabel(name, row))}</option>`,
          )
          .join("");
      if (old !== options) {
        select.innerHTML = options;
        if (value && data.some((row) => String(row[pk]) === value))
          select.value = value;
        else if (value) {
          const missing = new Option(
            value + " · no longer active",
            value,
            true,
            true,
          );
          missing.disabled = true;
          select.add(missing);
        }
      }
      select.dataset.loaded = "true";
      select.disabled = !data.length;
    }
  }
  async function openForm(row = null) {
    if (!permitted(row ? 1 : 0)) return;
    const isUser = view === "users";
    const resource = view;
    const editing = !!row;
    const c = cfg();
    const automatic=!editing&&schema.autoCodes?.[view];
    const fields = isUser ? [] : automatic ? [...new Set([automatic.field,...c.fields])] : c.fields;
    let body = isUser
      ? `<div class="dialog-fields"><label class="field"><span>Name</span><input name="name" maxlength="160" value="${h(row?.name || "")}" required></label><label class="field"><span>Email</span><input name="email" type="email" maxlength="254" value="${h(row?.email || "")}" required></label><label class="field"><span>Role</span><select name="role" ${user.role !== "superadmin" || row?.role === "superadmin" ? "disabled" : ""}>${["user", "admin", ...(row?.role === "superadmin" ? ["superadmin"] : [])].map((v) => `<option value="${v}" ${v === (row?.role || "user") ? "selected" : ""}>${h(v)}</option>`).join("")}</select></label>${editing ? `<label class="field"><span>Status</span><select name="status"><option value="pending" ${row.status === "pending" ? "selected" : ""}>Pending</option><option value="approved" ${row.status === "approved" ? "selected" : ""} ${row.status === "pending" && user.role !== "superadmin" ? "disabled" : ""}>Approved</option><option value="blocked" ${row.status === "blocked" ? "selected" : ""}>Blocked</option></select></label>` : "<p>New accounts await approval. Passwords are set through a setup link.</p>"}</div>`
      : `<div class="dialog-fields">${fields.map((f) => input(f, row, editing)).join("")}</div>`;
    if(automatic?.choosePrefix)body+=`<label class="field"><span>Code prefix</span><select name="_code_prefix" required><option value="">Loading prefixes�</option></select></label>`;
    if (view === "sales" && !editing)
      body +=
        '<section class="live-sale-lines"><h3>Sale items</h3><p>Unit prices come from the selected product’s price history for the sale date.</p><div id="live-lines"></div><button type="button" class="dialog-secondary" id="live-line-add">Add item</button><p id="live-sale-total">Total: —</p></section>';
    const d = showDialog(
      `${editing ? "Edit" : "Add"} ${singular(view)}`,
      `<fieldset class="live-edit-fields" data-record-key="${h(row ? rowKey(row) : "")}" data-record-version="${h(row?.updated_at || "")}">${body}</fieldset>`,
      '<button type="submit" class="module-primary" id="live-save">Save</button>',
    );
    const reload = document.createElement("button");
    reload.type = "button";
    reload.className = "dialog-secondary";
    reload.textContent = "Reload saved record";
    reload.hidden = !editing;
    reload.onclick = async () => {
      d.close();
      await openRecord(row);
    };
    d.querySelector(".dialog-actions").prepend(reload);
    if (view === "sales" && !editing) {
      d.querySelector("#live-line-add").onclick = () => addSaleLine(d);
      await addSaleLine(d);
      d.querySelector('[name="salesdate"]').onchange = () => {
        d.querySelectorAll(".live-sale-line").forEach((line) =>
          priceLine(d, line),
        );
      };
    }
    try {
      await refreshChoices(d);
    } catch (e) {
      d.querySelector(".live-dialog-notice").textContent = e.message;
    }
    if(automatic){
      let codePreviewVersion=0;
      const preview=async(prefix)=>{const attempt=++codePreviewVersion;d.querySelector("[data-auto-code]").value="";const result=(await request(`/api/next-code/${resource}`+(prefix?`?prefix=${encodeURIComponent(prefix)}`:""))).data;if(!d.open||resource!==view||attempt!==codePreviewVersion)return;d.querySelector("[data-auto-code]").value=result.code;const select=d.querySelector('[name="_code_prefix"]');if(select){select.innerHTML=result.prefixes.map(p=>`<option value="${h(p)}">${h(p)}</option>`).join("");select.value=result.prefix;select.onchange=()=>preview(select.value).catch(e=>d.querySelector(".live-dialog-notice").textContent=e.message);}};
      try{await preview();}catch(e){d.querySelector(".live-dialog-notice").textContent=e.message;}
    }
    if (!d.open || resource !== view) return;
    d.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      const button = d.querySelector("#live-save");
      button.disabled = true;
      d.querySelector(".live-dialog-notice").textContent = "Saving…";
      try {
        if (d.querySelector("select[data-lookup][required]:disabled"))
          throw new Error("Add the required related records before saving.");
        const payload = {};
        for (const element of d.querySelectorAll("[name]")) {
          if (element.disabled || element.closest(".live-sale-line")) continue;
          const key = element.name;
          if(!editing && automatic?.field===key)continue;
          let value = element.value;
          if (!isUser && schema.fields[key]?.[1] === "number")
            value = value === "" ? null : Number(value);
          else if (value === "") value = null;
          if (!editing || value !== row[key]) payload[key] = value;
        }
        if (resource === "sales" && !editing) {
          payload.lines = [...d.querySelectorAll(".live-sale-line")].map(
            (line) => ({
              prodcode: line.querySelector("[data-product]").value,
              quantity: Number(line.querySelector("[data-quantity]").value),
            }),
          );
          if (payload.lines.some((line) => !line.prodcode))
            throw new Error("Select a product for every sale item.");
        }
        if (!Object.keys(payload).length) {
          d.close();
          return;
        }
        await send(
          editing
            ? urlFor(rowKey(row))
            : isUser
              ? "/api/admin/users"
              : "/api/" + resource,
          editing ? (isUser ? "PUT" : "PATCH") : "POST",
          payload,
          row,
        );
        d.close();
        await load(true);
      } catch (e) {
        d.querySelector(".live-dialog-notice").textContent = e.message;
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    };
  }
  async function addSaleLine(d) {
    const line = document.createElement("div");
    line.className = "live-sale-line";
    line.innerHTML =
      '<label class="field"><span>Product</span><select data-product data-lookup="products" data-purpose="sales" required><option value="">Loading products…</option></select></label><label class="field"><span>Quantity</span><input data-quantity type="number" min="0" step="0.01" value="1" required></label><label class="field"><span>Unit price</span><input data-price readonly aria-label="Unit price"></label><label class="field"><span>Line total</span><output data-total>—</output></label><button type="button" class="dialog-secondary" aria-label="Remove item">Remove</button>';
    d.querySelector("#live-lines").append(line);
    line.querySelector("button").onclick = () => {
      if (d.querySelectorAll(".live-sale-line").length === 1) {
        d.querySelector(".live-dialog-notice").textContent =
          "A sale needs at least one item.";
        return;
      }
      line.remove();
      totalSale(d);
    };
    line.querySelector("[data-product]").onchange = () => priceLine(d, line);
    line.querySelector("[data-quantity]").oninput = () => totalSale(d);
    await refreshChoices(d);
  }
  async function priceLine(d, line) {
    const product = line.querySelector("[data-product]").value;
    const date = d.querySelector('[name="salesdate"]').value;
    const sequence = String((Number(line.dataset.request) || 0) + 1);
    line.dataset.request = sequence;
    line.dataset.price = "";
    if (!product || !date) {
      line.querySelector("[data-price]").value = "Select product and date";
      totalSale(d);
      return;
    }
    try {
      const { data } = await request(
        `/api/sale-price?product=${encodeURIComponent(product)}&date=${date}`,
      );
      if (line.dataset.request !== sequence) return;
      line.dataset.price = data ? String(data.unitprice) : "";
      line.querySelector("[data-price]").value = data
        ? money(data.unitprice)
        : "No effective price";
      totalSale(d);
    } catch (e) {
      d.querySelector(".live-dialog-notice").textContent = e.message;
    }
  }
  function totalSale(d) {
    let total = 0,
      complete = true;
    d.querySelectorAll(".live-sale-line").forEach((line) => {
      if (line.dataset.price === undefined || line.dataset.price === "") {
        complete = false;
        line.querySelector("[data-total]").textContent = "—";
        return;
      }
      const amount =
        Number(line.dataset.price) *
        Number(line.querySelector("[data-quantity]").value);
      line.querySelector("[data-total]").textContent = money(amount);
      total += amount;
    });
    d.querySelector("#live-sale-total").textContent =
      "Total: " + (complete ? money(total) : "—");
  }
  async function openRights(row) {
    const catalogue = (await request("/api/admin/rights-catalogue")).data;
    const rights = (await request(urlFor(row.id) + "/rights")).data;
    const groups = {};
    for (const [key, text] of Object.entries(catalogue)) {
      const module = key.split(".")[0];
      (groups[module] ??= []).push([key, text]);
    }
    const d = showDialog(
      "Assign rights · " + row.name,
      `<div class="live-rights-tools"><button type="button" class="dialog-secondary" data-all>All</button><button type="button" class="dialog-secondary" data-none>None</button></div><div class="permission-groups">${Object.entries(
        groups,
      )
        .map(
          ([mod, items]) =>
            `<fieldset><legend><label><input type="checkbox" data-gate="${mod}" ${rights[mod + ".view"] ? "checked" : ""}> ${h(mod === "hr" ? "Human Resources" : mod)}</label></legend><div>${items
              .filter(([key]) => !key.endsWith(".view"))
              .map(
                ([key, text]) =>
                  `<label><input type="checkbox" data-right="${key}" ${rights[key] ? "checked" : ""}> ${h(text)}</label>`,
              )
              .join("")}</div></fieldset>`,
        )
        .join("")}</div>`,
      '<button type="submit" class="module-primary" id="rights-save">Save rights</button>',
    );
    function gates() {
      d.querySelectorAll("[data-gate]").forEach((g) =>
        g
          .closest("fieldset")
          .querySelectorAll("[data-right]")
          .forEach((b) => (b.disabled = !g.checked)),
      );
    }
    gates();
    d.querySelectorAll("[data-gate]").forEach((b) => (b.onchange = gates));
    for (const [attr, value] of [
      ["data-all", true],
      ["data-none", false],
    ])
      d.querySelector("[" + attr + "]").onclick = () => {
        d.querySelectorAll('input[type="checkbox"]').forEach(
          (b) => (b.checked = value),
        );
        gates();
      };
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const button = d.querySelector("#rights-save");
      button.disabled = true;
      try {
        const value = {};
        d.querySelectorAll("[data-gate]").forEach(
          (b) => (value[b.dataset.gate + ".view"] = b.checked),
        );
        d.querySelectorAll("[data-right]").forEach(
          (b) => (value[b.dataset.right] = b.checked && !b.disabled),
        );
        await send(urlFor(row.id) + "/rights", "PUT", { rights: value }, row);
        d.close();
        await load(true);
      } catch (error) {
        d.querySelector(".live-dialog-notice").textContent = error.message;
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    };
  }
  async function loadAdministration() {
    if (
      view === "settings" &&
      document.querySelector("#live-settings")?.dataset.dirty === "true"
    )
      return;
    document.querySelector("#live-add").hidden = true;
    document.querySelector("#live-toolbar").hidden = view!=="audit-log";
    if(view!=="audit-log")document.querySelector("#live-filters").hidden=true;
    const result = await request("/api/admin/" + view);
    if (view === "audit-log") {
      const fields = [
        "action_at",
        "table_name",
        "record_key",
        "action",
        "action_by",
        "new_values",
      ];
      showAuxRows(result.data,"#live-content");
    } else {
      const values = Object.fromEntries(
        result.data.map((r) => [r.key, r.value]),
      );
      document.querySelector("#live-content").innerHTML =
        '<article class="panel live-welcome"><form id="live-settings">' +
        ["company_name", "company_address", "report_footer"]
          .map(
            (k) =>
              `<label class="field"><span>${h(k.replaceAll("_", " "))}</span><input name="${k}" value="${h(values[k] || "")}" maxlength="1000"></label>`,
          )
          .join("") +
        '<button class="module-primary">Save settings</button><p role="status"></p></form></article>';
      const form = document.querySelector("#live-settings");
      form.oninput = () => (form.dataset.dirty = "true");
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          for (const el of form.querySelectorAll("input"))
            await send("/api/admin/settings/" + el.name, "PUT", {
              value: el.value,
            });
          form.dataset.dirty = "false";
          form.querySelector('[role="status"]').textContent = "Settings saved.";
        } catch (err) {
          form.querySelector('[role="status"]').textContent = err.message;
        }
      };
    }
  }
  const reportRights = {
    "top-customers": "topCustomers",
    "product-master-list": "productMaster",
    "top-products": "topProducts",
    "active-employees": "activeEmployees",
    "all-employees": "allEmployees",
    "employee-job-history": "empJobHistory",
    "top-sales": "topSales",
  };
  const reports = {
    "top-customers": "Top Customers",
    "product-master-list": "Product Master List",
    "top-products": "Top Products",
    "active-employees": "Active Employees",
    "all-employees": "All Employees",
    "employee-job-history": "Employee Job History",
    "top-sales": "Top Sales",
  };
  function renderReports() {
    lastReportUrl = null;
    document.querySelector("#live-toolbar").hidden = false;
    document.querySelector("#live-filter").closest("label").hidden = true;
    document.querySelector("#live-add").hidden = true;
    document.querySelector("#live-content").innerHTML =
      `<article class="panel live-welcome"><form id="live-reports"><div class="dialog-fields"><label class="field"><span>Report</span><select name="report">${Object.entries(
        reports,
      )
        .filter(([key]) => can("reports." + reportRights[key]))
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join(
          "",
        )}</select></label><label class="field"><span>From (optional)</span><input name="from" type="date"></label><label class="field"><span>To (optional)</span><input name="to" type="date"></label><label class="field"><span>Top results</span><input name="top" type="number" value="10" min="1" max="100"></label><label class="field" id="report-employee-label" hidden><span>Employee</span><select name="employee" data-lookup="employees" data-purpose="reports"><option value="">Select employee</option></select></label></div><button class="module-primary">Run report</button><button class="dialog-secondary" type="button" id="report-print">Print / Save as PDF</button><p role="status"></p></form></article><article class="panel records-panel" id="report-result"></article>`;
    const form = document.querySelector("#live-reports");
    form.elements.report.onchange = async () => {
      const needs = form.elements.report.value === "employee-job-history";
      form.querySelector("#report-employee-label").hidden = !needs;
      form.elements.employee.required = needs;
      if (needs)
        try {
          await refreshChoices(form);
        } catch (e) {
          form.querySelector('[role="status"]').textContent = e.message;
        }
    };
    document.querySelector("#report-print").onclick = () => print();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const params = new URLSearchParams(new FormData(form));
      const report = params.get("report");
      params.delete("report");
      try {
        lastReportUrl = "/api/reports/" + report + "?" + params;
        const result = await request(lastReportUrl);
        showAuxRows(result.data,"#report-result");
        form.querySelector('[role="status"]').textContent =
          result.data.length + " rows returned.";
      } catch (err) {
        form.querySelector('[role="status"]').textContent = err.message;
      }
    };
  }
  async function start() {
    try {
      const params=new URLSearchParams(location.search);params.set("screen",module);params.set("status","active");params.set("limit","50");
      const boot=(await request("/api/ui-bootstrap?"+params)).data;
      user=boot.user;schema=boot.schema;
      if(boot.records)initialRecords={view:boot.view,result:boot.records};
      if(lifecycle.signal.aborted)return;
      await shell();
      if(lifecycle.signal.aborted)return;
      await load(true);
      const route=new URLSearchParams(location.search);
      if(route.has("record") && cfg()) {
        const parts=route.get("record").split("~");
        if(parts.length===cfg().pk.length)await openRecord(Object.fromEntries(cfg().pk.map((key,i)=>[key,parts[i]])));
        else notice("Invalid record link.",true);
      } else if(route.get("action")==="add" && permitted(0)) openForm();
      timer = setInterval(() => {
        if (view === "reports") {
          const form = document.querySelector("#live-reports");
          if (form && !form.querySelector("#report-employee-label").hidden)
            refreshChoices(form).catch((e) => notice(e.message, true));
        }

        load();
      }, 5000);
      window.addEventListener("focus", () => load(), {signal:lifecycle.signal});
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) load();
      }, {signal:lifecycle.signal});
    } catch (error) {
      if(lifecycle.signal.aborted)return;
      const workspace=app.querySelector(".workspace");
      if(workspace)workspace.textContent=error.message;else app.textContent=error.message;
      app.setAttribute("aria-busy", "false");
    } finally {document.dispatchEvent(new Event("hope:ready"));}
  }
  start();
})();
