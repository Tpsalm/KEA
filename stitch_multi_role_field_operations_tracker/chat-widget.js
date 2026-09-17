(() => {
  const styles = `
    #kea-chat-launcher{position:fixed;right:18px;bottom:92px;z-index:60;width:50px;height:50px;border:0;border-radius:16px;background:#a6e358;color:#203700;box-shadow:0 8px 24px #0008;cursor:pointer}
    #kea-chat-panel{position:fixed;right:18px;bottom:154px;z-index:60;width:min(380px,calc(100vw - 32px));max-height:min(590px,calc(100vh - 190px));display:none;flex-direction:column;overflow:hidden;border:1px solid #424938;border-radius:16px;background:#131b2e;color:#dae2fd;box-shadow:0 20px 60px #0009;font-family:Plus Jakarta Sans,Segoe UI,sans-serif}
    #kea-chat-panel.open{display:flex}#kea-chat-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:#171f33;border-bottom:1px solid #2d3449}
    #kea-chat-title{font:700 13px Space Grotesk,Segoe UI,sans-serif}#kea-chat-subtitle{margin-top:3px;color:#c2c9b3;font:10px JetBrains Mono,monospace;text-transform:uppercase}
    #kea-chat-close{border:0;background:transparent;color:#dae2fd;font-size:20px;cursor:pointer}#kea-chat-channel{margin:10px 12px 0;padding:8px;border:1px solid #424938;border-radius:8px;background:#0b1326;color:#dae2fd;font-size:12px}
    #kea-chat-messages{display:flex;flex:1;flex-direction:column;gap:8px;min-height:180px;max-height:310px;overflow:auto;padding:12px}
    .kea-chat-message{max-width:86%;padding:9px 11px;border-radius:12px;background:#222a3d;font-size:12px;line-height:1.45}.kea-chat-message.mine{align-self:flex-end;background:#a6e358;color:#203700}.kea-chat-meta{display:block;margin-bottom:3px;font:10px JetBrains Mono,monospace;opacity:.72}.kea-chat-attachment{display:inline-flex;margin-top:6px;color:inherit;font-weight:700;text-decoration:underline}
    #kea-chat-compose{display:flex;gap:7px;padding:10px;border-top:1px solid #2d3449}#kea-chat-input{min-width:0;flex:1;padding:10px;border:1px solid #424938;border-radius:10px;background:#0b1326;color:#dae2fd}#kea-chat-file{display:none}.kea-chat-icon{border:0;border-radius:10px;padding:0 10px;background:#222a3d;color:#dae2fd;cursor:pointer}.kea-chat-send{background:#a6e358;color:#203700}
    @media(max-width:600px){#kea-chat-launcher{right:14px;bottom:88px}#kea-chat-panel{right:14px;bottom:148px}}
  `;
  const style = document.createElement('style');
  style.textContent = styles;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.id = 'kea-chat-launcher';
  launcher.setAttribute('aria-label', 'Open private chat');
  launcher.innerHTML = '<span class="material-symbols-outlined">chat</span>';
  document.body.appendChild(launcher);

  const panel = document.createElement('section');
  panel.id = 'kea-chat-panel';
  panel.innerHTML = `<div id="kea-chat-head"><div><div id="kea-chat-title">Private Operations Chat</div><div id="kea-chat-subtitle">LIVE ENCRYPTED THREAD</div></div><button id="kea-chat-close" aria-label="Close chat">×</button></div><select id="kea-chat-channel" aria-label="Private chat channel"></select><div id="kea-chat-messages"><div class="kea-chat-message">Loading private messages...</div></div><div id="kea-chat-compose"><label class="kea-chat-icon" for="kea-chat-file" title="Attach a file"><span class="material-symbols-outlined">attach_file</span></label><input id="kea-chat-file" type="file"><input id="kea-chat-input" placeholder="Write a private message..." maxlength="2000"><button class="kea-chat-icon kea-chat-send" id="kea-chat-send" aria-label="Send message"><span class="material-symbols-outlined">send</span></button></div>`;
  document.body.appendChild(panel);

  let user = null;
  let channel = null;
  const channelLabels = {
    'super_admin-supervisor': 'Super Admin ↔ Supervisor',
    'supervisor-merchandiser': 'Supervisor ↔ Merchandiser',
    'supervisor-vsr': 'Supervisor ↔ VSR'
  };
  const channelsForRole = {
    super_admin: ['super_admin-supervisor'], supervisor: ['super_admin-supervisor', 'supervisor-merchandiser', 'supervisor-vsr'], merchandiser: ['supervisor-merchandiser'], vsr: ['supervisor-vsr']
  };
  const messages = document.getElementById('kea-chat-messages');
  const select = document.getElementById('kea-chat-channel');

  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
  }
  function render(items) {
    messages.replaceChildren();
    if (!items.length) { messages.innerHTML = '<div class="kea-chat-message">No messages yet. Start the private thread.</div>'; return; }
    items.forEach(item => {
      const bubble = document.createElement('div');
      bubble.className = `kea-chat-message${item.sender === user.name ? ' mine' : ''}`;
      const meta = document.createElement('span'); meta.className = 'kea-chat-meta'; meta.textContent = `${item.sender} · ${new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      bubble.appendChild(meta);
      if (item.message) bubble.appendChild(document.createTextNode(item.message));
      if (item.attachmentUrl) { const link = document.createElement('a'); link.className = 'kea-chat-attachment'; link.href = item.attachmentUrl; link.target = '_blank'; link.textContent = `Attachment: ${item.attachmentName}`; bubble.appendChild(document.createElement('br')); bubble.appendChild(link); }
      messages.appendChild(bubble);
    });
    messages.scrollTop = messages.scrollHeight;
  }
  async function load() {
    if (!channel) return;
    const response = await fetch(`/api/chats/${encodeURIComponent(channel)}`);
    if (response.ok) render(await response.json());
  }
  async function send() {
    const input = document.getElementById('kea-chat-input');
    const fileInput = document.getElementById('kea-chat-file');
    const file = fileInput.files[0];
    if (!input.value.trim() && !file) return;
    const body = { message: input.value.trim() };
    if (file) body.attachment = { name: file.name, dataUrl: await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); }) };
    const response = await fetch(`/api/chats/${encodeURIComponent(channel)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) return alert((await response.json()).error || 'Unable to send private message.');
    input.value = ''; fileInput.value = ''; await load();
  }
  function setChannel(value) { channel = value; document.getElementById('kea-chat-title').textContent = channelLabels[value]; load(); }
  launcher.onclick = () => { panel.classList.toggle('open'); if (panel.classList.contains('open') && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); };
  document.getElementById('kea-chat-close').onclick = () => panel.classList.remove('open');
  document.getElementById('kea-chat-send').onclick = send;
  document.getElementById('kea-chat-input').onkeydown = event => { if (event.key === 'Enter') send(); };
  select.onchange = () => setChannel(select.value);

  fetch('/api/auth/me').then(response => response.ok ? response.json() : null).then(result => {
    if (!result) return;
    user = result.user;
    const available = channelsForRole[user.role] || [];
    available.forEach(item => { const option = document.createElement('option'); option.value = item; option.textContent = channelLabels[item]; select.appendChild(option); });
    if (!available.length) return;
    if (available.length === 1) select.style.display = 'none';
    setChannel(available[0]);
    const stream = new EventSource('/api/live');
    stream.addEventListener('private-message', event => {
      const item = JSON.parse(event.data);
      if (item.channel !== channel || item.sender === user.name) return;
      notify(`New message from ${item.sender}`, item.message || `Attachment: ${item.attachmentName}`);
      if (panel.classList.contains('open')) load();
    });
  }).catch(() => {});
})();
