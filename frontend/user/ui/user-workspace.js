(() => {
  const page = document.body.dataset.page || "dashboard";
  const app = document.querySelector("#app");
  const labels = { dashboard: "Account home", profile: "My Profile", access: "My Access", security: "Security" };
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"/></svg>',
    profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5Z"/></svg>',
    access: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5.2 3.4 9.8 8 11 4.6-1.2 8-5.8 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z"/></svg>',
    security: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v10h14V10a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V6Zm3 9.7V18h-2v-2.3a2 2 0 1 1 2 0Z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H4v18h6v-2H6V5h4V3Zm5.6 4.6L14.2 9l2 2H9v2h7.2l-2 2 1.4 1.4L20 12l-4.4-4.4Z"/></svg>'
  };
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "content-type": "application/json", ...options.headers } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "The request failed.");
    return result.data;
  }

  function content(user) {
    if (page === "profile") return `<article class="panel"><header class="panel-header"><div><p class="eyebrow">Account identity</p><h2>Profile details</h2></div></header><dl><div class="user-detail"><dt>Name</dt><dd>${escape(user.name)}</dd></div><div class="user-detail"><dt>Username</dt><dd>${escape(user.username || "Not set")}</dd></div><div class="user-detail"><dt>Email</dt><dd>${escape(user.email)}</dd></div><div class="user-detail"><dt>Account status</dt><dd>${escape(user.status)}</dd></div></dl><p class="user-notice">Contact an administrator when your account identity needs to be changed.</p></article>`;
    if (page === "access") {
      const granted = Object.entries(user.rights || {}).filter(([, allowed]) => allowed).map(([right]) => `<li>${escape(right)}</li>`).join("");
      return `<article class="panel"><header class="panel-header"><div><p class="eyebrow">Authorization</p><h2>Your assigned access</h2></div></header><dl><div class="user-detail"><dt>Website account</dt><dd>User</dd></div><div class="user-detail"><dt>Business role</dt><dd>Not assigned</dd></div></dl><div class="user-notice">Your account is active, but it has not been assigned a Staff role. Contact an administrator if you need access to company operations.</div><h3>Effective permissions</h3><ul class="permission-list">${granted || "<li>No operational permissions</li>"}</ul></article>`;
    }
    if (page === "security") return `<article class="panel"><header class="panel-header"><div><p class="eyebrow">Account security</p><h2>Password and sign-in</h2></div></header><p>Password recovery and password changes use the verified email address on your account.</p><div class="user-grid"><a class="quick-action" href="/UI-UX/index.html"><span aria-hidden="true">?</span><div><strong>Open sign-in help</strong><small>Use Forgot password from the sign-in page</small></div><b aria-hidden="true">&gt;</b></a><button class="quick-action" id="security-logout" type="button"><span aria-hidden="true">S</span><div><strong>Sign out</strong><small>End this browser session</small></div><b aria-hidden="true">&gt;</b></button></div></article>`;
    return `<section class="metrics-grid user-metrics" aria-label="Business summary"><article class="metric-card metric-card--dark"><div class="card-heading"><span class="card-icon">↗</span><span>Net sales</span></div><strong>$0</strong><p>No Staff access</p><div class="mini-bars" aria-hidden="true"><i style="--h:42%"></i><i style="--h:61%"></i><i style="--h:48%"></i><i style="--h:78%"></i><i style="--h:68%"></i></div></article><article class="metric-card metric-card--gold"><div class="card-heading"><span class="card-icon">$</span><span>Outstanding</span></div><strong>$0</strong><p>No Staff access</p><div class="progress"><span style="width:0%"></span></div><small>0% collected</small></article><article class="metric-card"><div class="card-heading"><span class="card-icon">◎</span><span>Active employees</span></div><strong>0</strong><p>No Staff access</p><div class="avatar-row"><span>HR</span><span>0</span></div></article><article class="metric-card"><div class="card-heading"><span class="card-icon">□</span><span>Products</span></div><strong>0</strong><p>No Staff access</p><div class="status-chips"><span>0 products</span></div></article></section><section class="dashboard-grid user-dashboard-grid"><article class="panel"><header class="panel-header"><div><p class="eyebrow">Account overview</p><h2>Account details</h2></div></header><div class="user-notice">No Staff role is assigned. Business totals remain at zero until an administrator assigns operational access.</div><div class="table-wrap"><table class="user-account-table"><tbody><tr><td>Email</td><td>${escape(user.email)}</td></tr><tr><td>Username</td><td>${escape(user.username||'Not set')}</td></tr><tr><td>Workspace</td><td>User account</td></tr></tbody></table></div></article><aside class="panel quick-panel"><header class="panel-header"><div><p class="eyebrow">Shortcuts</p><h2>Account actions</h2></div></header><a class="quick-action" href="/UI-UX/user/profile/index.html"><span>${icons.profile}</span><div><strong>My Profile</strong><small>Review identity and status</small></div><b>→</b></a><a class="quick-action" href="/UI-UX/user/access/index.html"><span>${icons.access}</span><div><strong>My Access</strong><small>Review assigned access</small></div><b>→</b></a><a class="quick-action" href="/UI-UX/user/security/index.html"><span>${icons.security}</span><div><strong>Security</strong><small>Password and sign-in controls</small></div><b>→</b></a></aside></section>`;
  }

  async function start() {
    try {
      const user = await api("/api/auth/me");
      if (user.workspace !== "user") {
        location.replace(user.workspace === "staff" ? "/UI-UX/staff/modules/dashboard/index.html" : "/UI-UX/modules/dashboard/index.html");
        return;
      }
      const destinations=[["dashboard", "Account home"], ["profile", "My Profile"], ["access", "My Access"], ["security", "Security"]];
      const nav = destinations.map(([key, label]) => `<a class="nav-icon ${page === key ? "is-active" : ""}" href="/UI-UX/user/${key}/index.html" aria-label="${label}" ${page === key ? 'aria-current="page"' : ""}>${icons[key]}<span>${label}</span></a>`).join("");
      const tabs=destinations.map(([key,label])=>`<a class="${page===key?'is-active':''}" href="/UI-UX/user/${key}/index.html" ${page===key?'aria-current="page"':''}>${label}</a>`).join('');
      const initials = user.name.split(/\s+/).map((name) => name[0]).slice(0, 2).join("");
      app.innerHTML = `<aside class="sidebar" id="sidebar" aria-label="User account navigation"><button class="brand-toggle" id="sidebar-toggle" type="button" aria-label="Expand navigation" aria-expanded="false"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-title"><strong>HOPE, Inc.</strong><small>User account</small></span></button><nav class="sidebar-nav">${nav}</nav><div class="sidebar-bottom"><button class="nav-icon nav-icon--danger" id="user-logout" type="button" aria-label="Sign out">${icons.logout}<span>Sign out</span></button><div class="profile-button"><span class="avatar">${escape(initials)}</span><span class="profile-copy"><strong>${escape(user.name)}</strong><small>Website user</small></span></div></div></aside><section class="workspace"><header class="topbar"><div><p class="eyebrow">HOPE account</p><h1>${page==='dashboard'?'Welcome back, '+escape(user.name)+'.':labels[page]}</h1><p class="subtitle">${page==='dashboard'?'Here is your HOPE account overview.':'Account access without Staff business permissions.'}</p></div><button class="icon-button mobile-menu" id="user-menu" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button></header><nav class="module-tabs" aria-label="Account sections">${tabs}</nav><main class="user-workspace">${content(user)}</main></section>`;
      document.querySelector("#sidebar-toggle").onclick = (event) => { const open = document.querySelector("#sidebar").classList.toggle("is-expanded"); app.classList.toggle("sidebar-expanded", open); event.currentTarget.setAttribute("aria-expanded", String(open)); };
      document.querySelector("#user-menu").onclick = (event) => { const open = document.querySelector("#sidebar").classList.toggle("is-open"); event.currentTarget.setAttribute("aria-expanded", String(open)); };
      const logout = async () => { await api("/api/auth/logout", { method: "POST" }); location.replace("/UI-UX/index.html"); };
      document.querySelector("#user-logout").onclick = logout;
      document.querySelector("#security-logout")?.addEventListener("click", logout);
      app.setAttribute("aria-busy", "false");
    } catch (error) {
      app.innerHTML = `<section class="workspace"><div class="panel"><h1>Account unavailable</h1><p>${escape(error.message)}</p><a href="/UI-UX/index.html">Return to sign in</a></div></section>`;
      app.setAttribute("aria-busy", "false");
    }
  }
  start();
})();
