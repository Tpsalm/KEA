(() => {
  const script = document.currentScript;
  const asset = new URL('brand-logo.svg', new URL('.', script.src)).href;
  const style = document.createElement('style');
  style.textContent = '.kea-brand-lockup{display:block;position:relative;z-index:10;width:min(360px,82vw);height:auto;margin:28px auto 20px;background:transparent;border:0;box-shadow:none;text-align:center}.kea-brand-lockup img{display:block;width:100%;height:auto;margin:0 auto}.kea-brand-lockup:focus-visible{outline:2px solid #acd63f;outline-offset:3px}@media (min-width:1024px){.kea-brand-lockup{width:min(420px,42vw);margin:36px auto 28px}}';
  document.head.appendChild(style);
  document.querySelectorAll('body *').forEach(element => {
    if (element.children.length === 0 && element.textContent.trim() === 'KEA') element.textContent = '';
  });
  const lockup = document.createElement('a');
  lockup.className = 'kea-brand-lockup';
  lockup.href = '/';
  lockup.setAttribute('aria-label', 'Kea Corporate Hospitality Services home');
  const image = document.createElement('img');
  image.src = asset;
  image.alt = 'Kea Corporate Hospitality Services';
  lockup.appendChild(image);
  document.body.prepend(lockup);
})();
