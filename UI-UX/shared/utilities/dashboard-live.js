/* Bind Natalia's original dashboard elements to authenticated ERP records. */
(async () => {
  let alive=true, interval;
  const lifecycle=new AbortController();
  document.addEventListener('hope:leave',()=>{alive=false;lifecycle.abort();clearInterval(interval);delete window.refreshHopeDashboard;},{once:true});
  const shell = document.querySelector('.workspace');
  shell.hidden = true;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path) {
    const response = await fetch('/api/'+path,{credentials:'same-origin',signal:lifecycle.signal});
    if(response.status===401){location.replace('/UI-UX/index.html');throw new Error('Sign in required.');}
    const json=await response.json();if(!response.ok)throw new Error(json.message||'Records could not be loaded.');return json;
  }
  try {
    const bundle=(await api('ui-dashboard-data')).data;
    let user=bundle.user, dashboardData=bundle.records, firstSnapshot=true;
    const can=right=>user.role==='superadmin'||(user.rights?.[right.split('.')[0]+'.view']===true&&user.rights?.[right]===true);
    const navSource=(window.hopeSidebarTemplate?new DOMParser().parseFromString(window.hopeSidebarTemplate,'text/html'):document).querySelector('.sidebar-nav').innerHTML;
    function refreshNavigation(){
      const nav=document.querySelector('.sidebar-nav');nav.innerHTML=navSource;
      const names={Dashboard:['dashboard',true],Customers:['customers',can('customers.view')],Products:['products',can('products.view')],'Human Resources':['human-resources',can('hr.view')],Sales:['sales',can('sales.view')],'User Management':['user-management',['superadmin','admin'].includes(user.role)]};
      nav.querySelectorAll('a').forEach(a=>{const entry=names[a.getAttribute('aria-label')];if(!entry?.[1]){a.remove();return;}a.href='../'+entry[0]+'/index.html';a.classList.toggle('is-active',entry[0]==='dashboard');if(entry[0]==='dashboard')a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    }
    const resources={customers:'customers.view',products:'products.view',prices:'products.view',employees:'hr.view',departments:'hr.view',jobs:'hr.view',sales:'sales.view',payments:'sales.view'};
    async function records(name){return dashboardData[name]||[];}
    const sum=(rows,key)=>rows.reduce((a,r)=>a+Number(r[key]||0),0);
    const group=(rows,key)=>Object.entries(rows.reduce((a,r)=>{const k=r[key]||'Unspecified';a[k]=(a[k]||0)+1;return a;},{})).map(([label,value])=>({label:escape(label),value}));
    async function snapshot(){
      if(!firstSnapshot){const next=(await api('ui-dashboard-data')).data;const changed=JSON.stringify([user.role,user.rights])!==JSON.stringify([next.user.role,next.user.rights]);user=next.user;dashboardData=next.records;if(changed)refreshNavigation();}
      firstSnapshot=false;
      const [customers,products,prices,employees,departments,jobs,sales,payments]=await Promise.all(Object.keys(resources).map(records));
      const active=employees.filter(r=>!r.sepdate).length;
      const days=new Map();for(const [rows,date,key] of [[sales,'salesdate','total'],[payments,'paydate','amount']])for(const r of rows){const d=String(r[date]).slice(0,10);const item=days.get(d)||{date:d,sales:0,payments:0};item[key==='total'?'sales':'payments']+=Number(r[key]||0);days.set(d,item);}
      const months=new Map();for(const r of payments){const m=String(r.paydate).slice(0,7);months.set(m,(months.get(m)||0)+Number(r.amount));}
      return {snapshotLabel:'Live Supabase records',metrics:{totalSales:sum(sales,'total'),totalPayments:sum(payments,'amount'),outstanding:sum(sales,'balance'),employees:employees.length,activeEmployees:active,customers:customers.length,products:products.length,priceHistoryEntries:prices.length,salesTransactions:sales.length,paymentRecords:payments.length,departments:departments.length,jobs:jobs.length},dailyPerformance:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-7),insights:{customerTerms:group(customers,'payterm'),productUnits:group(products,'unit'),employeeStatus:[{label:'Active',value:active},{label:'Separated',value:employees.length-active}],employeeGender:group(employees,'gender'),employees:employees.slice(0,5).map(r=>({name:escape(r.firstname+' '+r.lastname),role:'Employee',status:r.sepdate?'Separated':'Active',initials:escape((r.firstname?.[0]||'')+(r.lastname?.[0]||''))})),monthlyPayments:[...months.entries()].sort().slice(-6).map(([label,value])=>({label,value}))},recentRecords:[...sales.map(r=>({title:escape(r.transno),detail:escape(r.custno),module:'Sales',date:String(r.salesdate).slice(0,10)})),...payments.map(r=>({title:escape(r.orno),detail:escape(r.transno)+' - '+Number(r.amount).toFixed(2),module:'Payments',date:String(r.paydate).slice(0,10)}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(r=>({...r,owner:'—',status:'Active',tone:'success'}))};
    }
    window.HOPE_DB_DATA=await snapshot();
    if(!alive)return;
    refreshNavigation();
    document.querySelector('.profile-copy strong').textContent=user.name;
    document.querySelector('.profile-copy small').textContent=user.role;
    document.querySelector('.avatar').textContent=user.name.split(/\s+/).map(n=>n[0]).slice(0,2).join('');
    document.querySelector('h1').textContent='Welcome back, '+user.name+'.';
    const pop=document.querySelector('#profile-popover');pop.querySelector('strong').textContent=user.name;pop.querySelector('span').textContent=user.role+' workspace';
    const script=document.createElement('script');script.src='dashboard.js?v=restored-live-1';
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;document.body.append(script);});
    shell.hidden=false;
    const refresh=async()=>{if(document.hidden)return;try{const data=await snapshot();if(alive)window.refreshHopeDashboard(data);}catch(e){window.showToast?.(e.message);}};
    interval=setInterval(refresh,5000);window.addEventListener('focus',refresh,{signal:lifecycle.signal});
  } catch(error){if(!alive)return;shell.hidden=false;const toast=document.querySelector('#toast');toast.textContent=error.message;toast.classList.add('is-visible');} finally {document.dispatchEvent(new Event('hope:ready'));}
})();
