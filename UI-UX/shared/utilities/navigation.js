/* Keep the original application frame mounted while changing workspaces. */
(() => {
  if(window.HopeNavigation)return;
  let navigating=false, pending;
  const isModule=url=>url.origin===location.origin&&/^\/(?:UI-UX\/)?modules\/[a-z-]+\/(?:index\.html)?$/.test(url.pathname);
  async function go(target,pop=false){
    const url=new URL(target,location.href);
    if(!isModule(url)){location.assign(url.href);return;}
    if(navigating){pending={target,pop};return;}
    if(url.href===location.href&&!pop)return;
    if(document.querySelector('dialog[open]'))return;
    navigating=true;
    const frame=document.querySelector('.dashboard-shell');
    try{
      const response=await fetch(url.href);if(!response.ok)throw new Error('Workspace could not be opened.');
      const page=new DOMParser().parseFromString(await response.text(),'text/html');
      // Fetch first, so the current workspace remains visible during navigation.
      document.dispatchEvent(new Event('hope:leave'));
      const module=url.pathname.match(/^\/(?:UI-UX\/)?modules\/([^/]+)\//)?.[1];
      document.body.dataset.module=module;
      document.title=page.title;
      if(!pop)history.pushState({},'',url.href);
      frame.id='app';
      const logout=frame.querySelector('#live-logout');if(logout)logout.id='logout-button';
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link=>{
        if(/dashboard-module|live-admin/.test(link.href))link.disabled=module==='dashboard';
      });
      for(const source of page.querySelectorAll('link[rel="stylesheet"]')){
        const href=new URL(source.getAttribute('href'),url).href;
        let link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(l=>l.href===href);
        if(!link){link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
        link.disabled=false;
      }
      const navigationStyle=document.querySelector('link[href*="navigation.css"]');if(navigationStyle)document.head.append(navigationStyle);
      document.querySelectorAll('body > .toast,body > .profile-popover').forEach(el=>el.remove());
      if(module==='dashboard'){
        const workspace=page.querySelector('.workspace');
        frame.querySelectorAll(':scope > :not(#sidebar)').forEach(el=>el.remove());
        frame.append(workspace);
        for(const selector of ['#toast','#profile-popover']){const el=page.querySelector(selector);if(el)document.body.append(el);}
      }
      frame.querySelectorAll('.sidebar-nav a').forEach(a=>{const active=new URL(a.href).pathname===url.pathname;a.classList.toggle('is-active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
      const script=document.createElement('script');
      script.src=(url.pathname.startsWith('/UI-UX/')?'/UI-UX':'')+'/shared/utilities/'+(module==='dashboard'?'dashboard-live.js':'live-admin.js');
      const ready=new Promise(resolve=>document.addEventListener('hope:ready',resolve,{once:true}));
      script.onerror=()=>document.dispatchEvent(new Event('hope:ready'));
      script.onload=()=>script.remove();document.body.append(script);
      await ready;
    }catch(error){console.error('Navigation failed:',error.message);}
    finally{navigating=false;if(pending){const next=pending;pending=null;go(next.target,next.pop);}}
  }
  window.HopeNavigation={go};
  const initialSidebar=document.querySelector('#sidebar');
  if(initialSidebar){const expanded=localStorage.getItem('hopeSidebarExpanded')==='true';initialSidebar.classList.toggle('is-expanded',expanded);document.querySelector('.dashboard-shell').classList.toggle('sidebar-expanded',expanded);const toggle=initialSidebar.querySelector('#sidebar-toggle');toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'Collapse navigation':'Expand navigation');}

  document.addEventListener('click',event=>{
    const toggle=event.target.closest('#sidebar-toggle');
    if(toggle){
      const sidebar=document.querySelector('#sidebar'),frame=document.querySelector('.dashboard-shell');
      const expanded=!sidebar.classList.contains('is-expanded');sidebar.classList.toggle('is-expanded',expanded);frame.classList.toggle('sidebar-expanded',expanded);toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'Collapse navigation':'Expand navigation');localStorage.setItem('hopeSidebarExpanded',String(expanded));return;
    }
    const link=event.target.closest('a[href]');
    if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0||link.target||link.hasAttribute('download'))return;
    const url=new URL(link.href);if(isModule(url)){event.preventDefault();go(url.href);}
  });
  window.addEventListener('popstate',()=>go(location.href,true));
})();
