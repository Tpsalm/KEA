(() => {
  const script = document.currentScript;
  const asset = new URL('brand-logo.svg', new URL('.', script.src)).href;
  const style = document.createElement('style');
  style.textContent = '.kea-brand-lockup{display:block;width:min(280px,72vw);height:auto;margin:14px auto 10px;background:transparent;border:0;box-shadow:none}.kea-brand-lockup img{display:block;width:100%;height:auto}.kea-brand-lockup:focus-visible{outline:2px solid #acd63f;outline-offset:3px}';
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
