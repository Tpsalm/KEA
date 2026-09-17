(() => {
  const rolePaths = [
    ['Super Admin', '../super_admin_console_mobile_field_command/code.html', 'shield_person'],
    ['Supervisor', '../supervisor_operations_hub_mobile/code.html', 'manage_accounts'],
    ['VSR Desk', '../vsr_field_terminal_mobile_sales_credit/code.html', 'desk'],
    ['Merchandiser', '../merchandiser_hub_mobile_stock_expiry/code.html', 'inventory_2']
  ];
  const style = document.createElement('style');
  style.textContent = `
    body{overflow-x:hidden}
    body>header{z-index:50}
    main.dashboard-shell{width:100%;max-width:1440px;margin:0 auto;box-sizing:border-box}
    main.dashboard-shell>.desktop-dashboard{width:100%;max-width:1320px;margin:0 auto;box-sizing:border-box}
    .kea-shell-menu-button{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-width:44px;border:0;border-radius:12px;background:#171f33;color:#dae2fd;cursor:pointer}
    .kea-shell-menu-button:hover,.kea-shell-menu-button:focus-visible{background:#2d3449;color:#a6e358;outline:2px solid #a6e358;outline-offset:2px}
    .kea-shell-drawer{position:fixed;inset:0;z-index:100;visibility:hidden;pointer-events:none}
    .kea-shell-drawer.open{visibility:visible;pointer-events:auto}
    .kea-shell-backdrop{position:absolute;inset:0;background:rgba(3,8,19,.68);opacity:0;transition:opacity .2s ease}
    .kea-shell-drawer.open .kea-shell-backdrop{opacity:1}
    .kea-shell-panel{position:absolute;top:0;right:0;width:min(360px,calc(100vw - 28px));height:100%;padding:24px 20px;box-sizing:border-box;background:#111a2d;color:#dae2fd;box-shadow:-18px 0 50px rgba(0,0,0,.4);transform:translateX(100%);transition:transform .25s ease;overflow-y:auto}
    .kea-shell-drawer.open .kea-shell-panel{transform:translateX(0)}
    .kea-shell-panel-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:18px;border-bottom:1px solid #2d3449}
    .kea-shell-panel-title{font:700 18px/1.2 Space Grotesk,sans-serif}
    .kea-shell-panel-subtitle{margin-top:4px;color:#c2c9b3;font:10px/1.4 JetBrains Mono,monospace;letter-spacing:.08em;text-transform:uppercase}
    .kea-shell-close{width:40px;height:40px;border:0;border-radius:10px;background:#222a3d;color:#dae2fd;font-size:24px;cursor:pointer}
    .kea-shell-section{margin-top:22px;color:#c2c9b3;font:10px JetBrains Mono,monospace;letter-spacing:.1em;text-transform:uppercase}
    .kea-shell-link{display:flex;align-items:center;gap:12px;margin-top:8px;padding:12px;border-radius:10px;color:#dae2fd;text-decoration:none;font:600 13px/1.3 Plus Jakarta Sans,sans-serif}
    .kea-shell-link:hover,.kea-shell-link:focus-visible{background:#222a3d;color:#a6e358;outline:none}
    .kea-shell-link .material-symbols-outlined{font-size:20px}
    @media (min-width:1024px){
      main.dashboard-shell{padding-left:32px;padding-right:32px}
      main.dashboard-shell>.desktop-dashboard{padding:0 8px 40px}
      .kea-shell-menu-button{margin-left:4px}
    }
  `;
  document.head.appendChild(style);

  const main = document.querySelector('main');
  const header = document.querySelector('body>header');
  if (!main || !header) return;
  main.classList.add('dashboard-shell');
  main.firstElementChild?.classList.add('desktop-dashboard');

  const headerTools = header.querySelector('header>div>div:last-child, body>header>div>div:last-child');
  if (!headerTools || document.querySelector('.kea-shell-menu-button')) return;
  const menuButton = document.createElement('button');
  menuButton.className = 'kea-shell-menu-button';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'Open dashboard menu');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.innerHTML = '<span class="material-symbols-outlined">menu</span>';
  headerTools.prepend(menuButton);

  const drawer = document.createElement('aside');
  drawer.className = 'kea-shell-drawer';
  drawer.setAttribute('aria-label', 'Dashboard navigation');
  drawer.innerHTML = `<div class="kea-shell-backdrop"></div><div class="kea-shell-panel" role="dialog" aria-modal="true" aria-label="Dashboard menu"><div class="kea-shell-panel-header"><div><div class="kea-shell-panel-title">Command surfaces</div><div class="kea-shell-panel-subtitle">KEA Corporate Hospitality Services</div></div><button class="kea-shell-close" type="button" aria-label="Close dashboard menu">&times;</button></div><div class="kea-shell-section">Role platforms</div><nav class="kea-shell-links"></nav><div class="kea-shell-section">Workspace</div><nav class="kea-shell-links kea-shell-workspace"><a class="kea-shell-link" href="/" data-menu-link><span class="material-symbols-outlined">dashboard</span>Web Directory</a><a class="kea-shell-link" href="/account.html" data-menu-link><span class="material-symbols-outlined">settings</span>Profile &amp; Settings</a><a class="kea-shell-link" href="/contact.html" data-menu-link><span class="material-symbols-outlined">support_agent</span>Contact Us</a><a class="kea-shell-link" href="/privacy.html" data-menu-link><span class="material-symbols-outlined">policy</span>Privacy Policy</a></nav></div>`;
  document.body.appendChild(drawer);

  const roleNav = drawer.querySelector('.kea-shell-links');
  rolePaths.forEach(([label, href, icon]) => {
    const link = document.createElement('a');
    link.className = 'kea-shell-link';
    link.href = href;
    link.setAttribute('data-menu-link', '');
    link.innerHTML = `<span class="material-symbols-outlined">${icon}</span>${label}`;
    roleNav.appendChild(link);
  });

  const close = () => {
    drawer.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  };
  menuButton.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  drawer.querySelector('.kea-shell-close').addEventListener('click', close);
  drawer.querySelector('.kea-shell-backdrop').addEventListener('click', close);
  drawer.querySelectorAll('[data-menu-link]').forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
})();
