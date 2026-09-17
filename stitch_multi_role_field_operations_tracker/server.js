require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { Pool } = require('pg');

const rootDir = __dirname;
const port = Number(process.env.PORT || 4173);
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}) : null;
const liveClients = new Set();
const sessions = new Map();

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(cookie => {
    const [key, ...value] = cookie.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
}

function getSession(request) {
  const token = parseCookies(request).kea_session;
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return session;
}

function setSession(response, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ...user, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  response.setHeader('Set-Cookie', `kea_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function clearSession(request, response) {
  const token = parseCookies(request).kea_session;
  if (token) sessions.delete(token);
  response.setHeader('Set-Cookie', 'kea_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function requiredRoleForPath(pathname) {
  if (pathname.startsWith('/super_admin_console_mobile_field_command')) return 'super_admin';
  if (pathname.startsWith('/supervisor_operations_hub_mobile')) return 'supervisor';
  if (pathname.startsWith('/vsr_field_terminal_mobile_sales_credit')) return 'vsr';
  if (pathname.startsWith('/merchandiser_hub_mobile_stock_expiry')) return 'merchandiser';
  if (pathname.startsWith('/api/admin/')) return 'super_admin';
  if (pathname.startsWith('/api/supervisor/')) return 'supervisor';
  if (pathname.startsWith('/api/vsr/')) return 'vsr';
  if (pathname.startsWith('/api/merchandiser/')) return 'merchandiser';
  if (pathname === '/api/admin/dashboard' || pathname === '/api/admin/audit-log') return 'super_admin';
  return null;
}

function hasAccess(user, role) {
  return user && user.role === role;
}

const chatParticipants = {
  'super_admin-supervisor': ['super_admin', 'supervisor'],
  'supervisor-merchandiser': ['supervisor', 'merchandiser'],
  'supervisor-vsr': ['supervisor', 'vsr']
};

function canUseChat(user, channel) {
  return Boolean(user && chatParticipants[channel]?.includes(user.role));
}

function emitLiveSync(type, payload) {
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of liveClients) {
    client.write(message);
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, payload, contentType) {
  response.writeHead(status, { 'Content-Type': contentType });
  response.end(payload);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

async function getDashboard() {
  const [metrics, requisitions, loans, locks, auditLog] = await Promise.all([
    pool.query('SELECT key, value FROM admin_metrics ORDER BY key'),
    pool.query('SELECT id, name, amount, status FROM requisitions ORDER BY id'),
    pool.query('SELECT name, category, days_past_due AS days, amount FROM loans ORDER BY id'),
    pool.query('SELECT name FROM handheld_locks ORDER BY name'),
    pool.query('SELECT action, detail, created_at AS at FROM audit_log ORDER BY created_at DESC LIMIT 50')
  ]);

  return {
    metrics: Object.fromEntries(metrics.rows.map(row => [row.key, row.value])),
    requisitions: requisitions.rows,
    loans: loans.rows,
    lockedReps: locks.rows.map(row => row.name),
    auditLog: auditLog.rows
  };
}

async function recordAudit(client, action, detail) {
  await client.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', [action, detail]);
}

function serveStatic(request, response, pathname, user) {
  if (pathname === '/account.html' && !user) {
    return response.writeHead(302, { Location: `/kea_portal_mobile_shift_clock_in_gateway/code.html?returnTo=${encodeURIComponent(pathname)}` }).end();
  }
  const requiredRole = requiredRoleForPath(pathname);
  if (requiredRole && !hasAccess(user, requiredRole)) {
    if (user) return sendText(response, 403, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Access Not Allowed</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#081124;color:#e9f0ff;font:16px system-ui,sans-serif;text-align:center}main{max-width:420px;padding:32px}h1{color:#ffb693}a{color:#a6e358}</style></head><body><main><p>KEA OPERATIONS SECURITY</p><h1>Access not allowed</h1><p>Your ${user.role.replace('_', ' ')} account can only open its assigned workspace.</p><a href="/">Return to web directory</a></main></body></html>`, 'text/html; charset=utf-8');
    return response.writeHead(302, { Location: `/kea_portal_mobile_shift_clock_in_gateway/code.html?returnTo=${encodeURIComponent(pathname)}` }).end();
  }
  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(rootDir, requestedPath);
  if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendText(response, 404, 'Not found', 'text/plain; charset=utf-8');
  }
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };
  sendText(response, 200, fs.readFileSync(filePath), contentTypes[extension] || 'application/octet-stream');
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const user = getSession(request);
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return response.end();
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      if (!pool) return sendJson(response, 503, { status: 'degraded', database: 'not configured' });
      await pool.query('SELECT 1');
      return sendJson(response, 200, { status: 'ok' });
    }

    if (url.pathname === '/api/auth/sign-in' && request.method === 'POST') {
      if (!pool) return sendJson(response, 503, { error: 'Database is not configured' });
      const body = await readBody(request);
      if (!body.staffId || !body.passcode || !['super_admin', 'supervisor', 'vsr', 'merchandiser'].includes(body.role)) return sendJson(response, 400, { error: 'Login, passcode, and role are required' });
      const result = await pool.query(`SELECT u.id, u.login, u.password_salt AS "passwordSalt", u.password_hash AS "passwordHash", u.role, s.staff_code AS "staffCode", s.name, s.hub FROM auth_users u LEFT JOIN staff s ON s.id = u.staff_id WHERE (u.login = $1 OR s.staff_code = $1 OR s.email = $1) AND u.role = $2 AND u.active = TRUE`, [body.staffId, body.role]);
      const account = result.rows[0];
      if (!account || hashPassword(body.passcode, account.passwordSalt) !== account.passwordHash) return sendJson(response, 401, { error: 'Credentials or role are not authorized' });
      const profile = { id: account.id, login: account.login, role: account.role, staffCode: account.staffCode || 'ADMIN', name: account.name || 'Super Admin', hub: account.hub || 'hq' };
      setSession(response, profile);
      const requestedReturn = typeof body.returnTo === 'string' && body.returnTo.startsWith('/') && !body.returnTo.startsWith('//') ? body.returnTo : null;
      return sendJson(response, 200, { user: profile, destination: requestedReturn || (account.role === 'super_admin' ? '/super_admin_console_mobile_field_command/code.html' : `/${account.role === 'vsr' ? 'vsr_field_terminal_mobile_sales_credit' : account.role === 'merchandiser' ? 'merchandiser_hub_mobile_stock_expiry' : 'supervisor_operations_hub_mobile'}/code.html`) });
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') return user ? sendJson(response, 200, { user }) : sendJson(response, 401, { error: 'Sign-in required' });
    if (url.pathname === '/api/auth/sign-out' && request.method === 'POST') { clearSession(request, response); return sendJson(response, 200, { ok: true }); }

    const chatMatch = url.pathname.match(/^\/api\/chats\/([^/]+)$/);
    if (chatMatch && ['GET', 'POST'].includes(request.method)) {
      const channel = decodeURIComponent(chatMatch[1]);
      if (!canUseChat(user, channel)) return sendJson(response, 403, { error: 'Private chat access is not allowed for this role' });
      if (request.method === 'GET') {
        const result = await pool.query('SELECT id, sender, sender_role AS "senderRole", recipient, message, attachment_name AS "attachmentName", attachment_type AS "attachmentType", created_at AS at FROM private_chat_messages WHERE channel = $1 ORDER BY created_at ASC LIMIT 100', [channel]);
        return sendJson(response, 200, result.rows.map(item => ({ ...item, attachmentUrl: item.attachmentName ? `/api/chats/${encodeURIComponent(channel)}/attachments/${item.id}` : null })));
      }
      const body = await readBody(request);
      const message = String(body.message || '').trim();
      const attachment = body.attachment;
      if (!message && !attachment?.dataUrl) return sendJson(response, 400, { error: 'Message or attachment is required' });
      let attachmentData = null;
      let attachmentName = null;
      let attachmentType = null;
      if (attachment?.dataUrl) {
        const match = String(attachment.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
        if (!match || !attachment.name) return sendJson(response, 400, { error: 'Attachment is invalid' });
        attachmentData = Buffer.from(match[2], 'base64');
        if (attachmentData.length > 10 * 1024 * 1024) return sendJson(response, 413, { error: 'Attachment must be 10MB or smaller' });
        attachmentName = attachment.name;
        attachmentType = match[1];
      }
      const recipientRole = chatParticipants[channel].find(role => role !== user.role);
      const recipient = recipientRole === 'super_admin' ? 'Super Admin' : recipientRole === 'supervisor' ? 'Davis Okon' : recipientRole === 'vsr' ? 'Sulaimon' : 'Kenji Sato';
      const result = await pool.query('INSERT INTO private_chat_messages (channel, sender, sender_role, recipient, message, attachment_name, attachment_type, attachment_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, sender, sender_role AS "senderRole", recipient, message, attachment_name AS "attachmentName", attachment_type AS "attachmentType", created_at AS at', [channel, user.name, user.role, recipient, message, attachmentName, attachmentType, attachmentData]);
      await pool.query('INSERT INTO user_notifications (recipient, title, message) VALUES ($1, $2, $3)', [recipient, 'New private chat message', message || `Attachment: ${attachmentName}`]);
      const chatMessage = { ...result.rows[0], attachmentUrl: attachmentName ? `/api/chats/${encodeURIComponent(channel)}/attachments/${result.rows[0].id}` : null };
      emitLiveSync('private-message', { channel, ...chatMessage });
      return sendJson(response, 201, chatMessage);
    }

    const attachmentMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/attachments\/(\d+)$/);
    if (attachmentMatch && request.method === 'GET') {
      const channel = decodeURIComponent(attachmentMatch[1]);
      if (!canUseChat(user, channel)) return sendJson(response, 403, { error: 'Private chat access is not allowed for this role' });
      const result = await pool.query('SELECT attachment_name AS name, attachment_type AS type, attachment_data AS data FROM private_chat_messages WHERE channel = $1 AND id = $2', [channel, attachmentMatch[2]]);
      if (!result.rowCount || !result.rows[0].data) return sendText(response, 404, 'Attachment not found', 'text/plain; charset=utf-8');
      response.writeHead(200, { 'Content-Type': result.rows[0].type, 'Content-Disposition': `inline; filename="${result.rows[0].name.replace(/"/g, '')}"` });
      return response.end(result.rows[0].data);
    }

    if (url.pathname === '/api/profile' && request.method === 'GET') {
      if (!user) return sendJson(response, 401, { error: 'Sign-in required' });
      const result = await pool.query('SELECT display_name AS "displayName", phone, avatar_type AS "avatarType", avatar_data IS NOT NULL AS "hasAvatar" FROM user_profiles WHERE login = $1', [user.login]);
      return sendJson(response, 200, { user, profile: result.rows[0] || null });
    }

    if (url.pathname === '/api/profile' && request.method === 'POST') {
      if (!user) return sendJson(response, 401, { error: 'Sign-in required' });
      const body = await readBody(request);
      let avatarData = null;
      let avatarType = null;
      if (body.avatar?.dataUrl) {
        const match = String(body.avatar.dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) return sendJson(response, 400, { error: 'Profile image must be an image file' });
        avatarData = Buffer.from(match[2], 'base64');
        if (avatarData.length > 5 * 1024 * 1024) return sendJson(response, 413, { error: 'Profile image must be 5MB or smaller' });
        avatarType = match[1];
      }
      await pool.query('INSERT INTO user_profiles (login, display_name, phone, avatar_type, avatar_data) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (login) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name), phone = COALESCE(EXCLUDED.phone, user_profiles.phone), avatar_type = COALESCE(EXCLUDED.avatar_type, user_profiles.avatar_type), avatar_data = COALESCE(EXCLUDED.avatar_data, user_profiles.avatar_data), updated_at = NOW()', [user.login, body.displayName || null, body.phone || null, avatarType, avatarData]);
      return sendJson(response, 200, { ok: true });
    }

    if (url.pathname === '/api/contact' && request.method === 'POST') {
      if (!user) return sendJson(response, 401, { error: 'Sign-in required' });
      const body = await readBody(request);
      if (!body.subject || !body.message || !String(body.message).trim()) return sendJson(response, 400, { error: 'Subject and message are required' });
      const result = await pool.query('INSERT INTO support_requests (sender_login, sender_name, subject, message) VALUES ($1, $2, $3, $4) RETURNING id, subject, message, status, created_at AS at', [user.login, user.name, String(body.subject).trim(), String(body.message).trim()]);
      await pool.query('INSERT INTO user_notifications (recipient, title, message) VALUES ($1, $2, $3)', ['Super Admin', `Support request: ${result.rows[0].subject}`, `${user.name}: ${result.rows[0].message}`]);
      emitLiveSync('support-request', { ...result.rows[0], sender: user.name });
      return sendJson(response, 201, result.rows[0]);
    }

    const avatarMatch = url.pathname.match(/^\/api\/profile\/avatar\/([^/]+)$/);
    if (avatarMatch && request.method === 'GET') {
      if (!user) return sendJson(response, 401, { error: 'Sign-in required' });
      const login = decodeURIComponent(avatarMatch[1]);
      if (login !== user.login) return sendJson(response, 403, { error: 'Profile access is not allowed' });
      const result = await pool.query('SELECT avatar_type AS type, avatar_data AS data FROM user_profiles WHERE login = $1', [login]);
      if (!result.rowCount || !result.rows[0].data) return sendText(response, 404, 'Profile image not found', 'text/plain; charset=utf-8');
      response.writeHead(200, { 'Content-Type': result.rows[0].type, 'Cache-Control': 'no-store' });
      return response.end(result.rows[0].data);
    }

    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/') && !user) return sendJson(response, 401, { error: 'Sign-in required' });
    const requiredRole = requiredRoleForPath(url.pathname);
    if (url.pathname.startsWith('/api/') && requiredRole && !hasAccess(user, requiredRole)) return sendJson(response, 403, { error: 'This role cannot access the requested workspace' });

    if (url.pathname === '/api/attendance/today' && request.method === 'GET') {
      const result = await pool.query('SELECT staff_code AS "staffCode", role, hub, clocked_in_at AS at FROM shift_clock_ins WHERE clocked_in_at::date = CURRENT_DATE ORDER BY clocked_in_at DESC');
      return sendJson(response, 200, result.rows);
    }

    if (url.pathname === '/api/auth/clock-in' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.staffId || !body.passcode || !['supervisor', 'vsr', 'merchandiser'].includes(body.role)) {
        return sendJson(response, 400, { error: 'Staff ID, passcode, and role are required' });
      }
      const staffResult = await pool.query('SELECT s.id, s.staff_code AS "staffCode", s.name, s.role, s.hub, u.login, u.password_salt AS "passwordSalt", u.password_hash AS "passwordHash", u.id AS "userId" FROM staff s JOIN auth_users u ON u.staff_id = s.id WHERE (s.staff_code = $1 OR s.email = $1 OR u.login = $1) AND s.role = $2 AND s.active = TRUE AND u.active = TRUE', [body.staffId, body.role]);
      const staff = staffResult.rows[0];
      if (!staff || hashPassword(body.passcode, staff.passwordSalt) !== staff.passwordHash) return sendJson(response, 401, { error: 'Staff credentials or role are not authorized' });
      const result = await pool.query('INSERT INTO shift_clock_ins (staff_id, staff_code, role, hub, latitude, longitude, accuracy_meters, telemetry_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING clocked_in_at AS at', [staff.id, staff.staffCode, staff.role, body.hub || staff.hub, body.latitude || null, body.longitude || null, body.accuracyMeters || null, body.telemetry || {}]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['shift_clock_in', `${staff.staffCode} ${staff.role}`]);
      const profile = { id: staff.userId, login: staff.login, role: staff.role, staffCode: staff.staffCode, name: staff.name, hub: staff.hub };
      setSession(response, profile);
      emitLiveSync('clock-in', { staffCode: staff.staffCode, name: staff.name, role: staff.role, hub: staff.hub, at: result.rows[0].at });
      return sendJson(response, 201, { staff: profile, clockIn: result.rows[0], destination: `/${staff.role === 'vsr' ? 'vsr_field_terminal_mobile_sales_credit' : staff.role === 'merchandiser' ? 'merchandiser_hub_mobile_stock_expiry' : 'supervisor_operations_hub_mobile'}/code.html` });
    }

    if (url.pathname === '/api/admin/users' && request.method === 'GET') {
      const result = await pool.query('SELECT u.login, u.role, s.staff_code AS "staffCode", s.name, s.email, s.hub, u.created_at AS "createdAt" FROM auth_users u LEFT JOIN staff s ON s.id = u.staff_id ORDER BY u.role, s.name NULLS FIRST');
      return sendJson(response, 200, result.rows);
    }

    if (url.pathname === '/api/admin/users' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.name || !body.email || !body.password || !['supervisor', 'vsr', 'merchandiser'].includes(body.role)) return sendJson(response, 400, { error: 'Name, email, role, and password are required' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const staffCode = body.staffCode || `${body.role.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const staffResult = await client.query('INSERT INTO staff (staff_code, email, name, role, region, hub, supervisor_name, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, staff_code AS "staffCode", email, name, role, hub, phone', [staffCode, body.email.trim(), body.name.trim(), body.role, body.region || 'Lagos', body.hub || 'lagos-main', body.supervisorName || 'Davis Okon', body.phone || null]);
        const salt = crypto.randomBytes(16).toString('hex');
        await client.query('INSERT INTO auth_users (staff_id, login, password_salt, password_hash, role) VALUES ($1, $2, $3, $4, $5)', [staffResult.rows[0].id, body.email.trim(), salt, hashPassword(body.password, salt), body.role]);
        await client.query('COMMIT');
        const staff = staffResult.rows[0];
        await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['user_provisioned', `${staff.staffCode} ${staff.role}`]);
        emitLiveSync('user-created', { staffCode: staff.staffCode, name: staff.name, role: staff.role });
        return sendJson(response, 201, { ...staff, login: staff.email, temporaryPassword: body.password });
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') return sendJson(response, 409, { error: 'That email or staff code is already provisioned' });
        throw error;
      } finally { client.release(); }
    }

    if (url.pathname === '/api/submissions' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.filename || !body.dataUrl || !['pod_tracker', 'monthly_report'].includes(body.submissionType)) return sendJson(response, 400, { error: 'Submission type, filename, and file are required' });
      const match = String(body.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return sendJson(response, 400, { error: 'Upload must be a base64 data URL' });
      const fileData = Buffer.from(match[2], 'base64');
      if (fileData.length > 10 * 1024 * 1024) return sendJson(response, 413, { error: 'File must be 10MB or smaller' });
      const result = await pool.query('INSERT INTO field_submissions (staff_code, role, submission_type, filename, content_type, file_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, staff_code AS "staffCode", role, submission_type AS "submissionType", filename, status, created_at AS at', [user.staffCode, user.role, body.submissionType, body.filename, match[1], fileData]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['field_submission', `${user.staffCode} ${body.submissionType} ${body.filename}`]);
      await pool.query('INSERT INTO user_notifications (recipient, title, message) VALUES ($1, $2, $3)', ['Davis Okon', 'New field submission', `${user.name} sent ${body.submissionType.replace('_', ' ')}`]);
      emitLiveSync('submission', result.rows[0]);
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/submissions' && request.method === 'GET') {
      const query = user.role === 'super_admin' || user.role === 'supervisor' ? 'SELECT id, staff_code AS "staffCode", role, submission_type AS "submissionType", filename, status, reviewer, created_at AS at, reviewed_at AS "reviewedAt" FROM field_submissions ORDER BY created_at DESC LIMIT 50' : 'SELECT id, staff_code AS "staffCode", role, submission_type AS "submissionType", filename, status, reviewer, created_at AS at, reviewed_at AS "reviewedAt" FROM field_submissions WHERE staff_code = $1 ORDER BY created_at DESC LIMIT 50';
      const result = await pool.query(query, user.role === 'super_admin' || user.role === 'supervisor' ? [] : [user.staffCode]);
      return sendJson(response, 200, result.rows);
    }

    const reviewMatch = url.pathname.match(/^\/api\/submissions\/(\d+)\/review$/);
    if (reviewMatch && request.method === 'POST') {
      if (!hasAccess(user, 'supervisor')) return sendJson(response, 403, { error: 'Only supervisors can review submissions' });
      const body = await readBody(request);
      if (!['reviewed', 'validated', 'rejected'].includes(body.status)) return sendJson(response, 400, { error: 'Invalid review status' });
      const result = await pool.query('UPDATE field_submissions SET status = $1, reviewer = $2, reviewed_at = NOW() WHERE id = $3 RETURNING id, staff_code AS "staffCode", status, submission_type AS "submissionType"', [body.status, user.name, reviewMatch[1]]);
      if (!result.rowCount) return sendJson(response, 404, { error: 'Submission not found' });
      await pool.query('INSERT INTO user_notifications (recipient, title, message) VALUES ($1, $2, $3)', [result.rows[0].staffCode, 'Submission reviewed', `${result.rows[0].submissionType.replace('_', ' ')} was marked ${body.status}`]);
      emitLiveSync('submission-review', result.rows[0]);
      return sendJson(response, 200, result.rows[0]);
    }

    if (url.pathname === '/api/notifications' && request.method === 'GET') {
      const recipients = user.staffCode ? [user.staffCode, user.name, user.login, 'All Staff'] : [user.name, user.login, 'All Staff'];
      const result = await pool.query('SELECT id, title, message, created_at AS at, read_at AS "readAt" FROM user_notifications WHERE recipient = ANY($1) ORDER BY created_at DESC LIMIT 30', [recipients]);
      return sendJson(response, 200, result.rows);
    }

    if (url.pathname === '/api/supervisor/dashboard' && request.method === 'GET') {
      const [staff, directives, actions] = await Promise.all([
        pool.query('SELECT staff_code AS "staffCode", name, role, region, hub, phone FROM staff WHERE active = TRUE ORDER BY role, name'),
        pool.query('SELECT audience, message, created_at AS at FROM directives ORDER BY created_at DESC LIMIT 25'),
        pool.query('SELECT action_type AS "actionType", sku, batch_number AS "batchNumber", created_at AS at FROM stock_actions ORDER BY created_at DESC LIMIT 25')
      ]);
      return sendJson(response, 200, { staff: staff.rows, directives: directives.rows, stockActions: actions.rows });
    }

    if (url.pathname === '/api/live' && request.method === 'GET') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      response.write('retry: 2000\n\n');
      response.write(`event: connected\ndata: ${JSON.stringify({ status: 'ok', at: new Date().toISOString() })}\n\n`);
      liveClients.add(response);
      request.on('close', () => liveClients.delete(response));
      return;
    }

    if (url.pathname === '/api/messages' && request.method === 'GET') {
      const result = await pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages ORDER BY created_at DESC LIMIT 50');
      return sendJson(response, 200, result.rows.reverse());
    }

    if (url.pathname === '/api/messages' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.message || !body.message.trim()) return sendJson(response, 400, { error: 'Message is required' });
      const sender = body.sender || 'System';
      const recipient = body.recipient || 'Davis Okon';
      const result = await pool.query('INSERT INTO supervisor_messages (sender, recipient, message) VALUES ($1, $2, $3) RETURNING sender, recipient, message, created_at AS at', [sender, recipient, body.message.trim()]);
      emitLiveSync('message', result.rows[0]);
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/supervisor/messages' && request.method === 'GET') {
      const result = await pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages ORDER BY created_at DESC LIMIT 50');
      return sendJson(response, 200, result.rows.reverse());
    }

    if (url.pathname === '/api/supervisor/messages' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.message || !body.message.trim()) return sendJson(response, 400, { error: 'Message is required' });
      const result = await pool.query('INSERT INTO supervisor_messages (sender, recipient, message) VALUES ($1, $2, $3) RETURNING sender, recipient, message, created_at AS at', [user.name, body.recipient || 'All Staff', body.message.trim()]);
      await pool.query('INSERT INTO user_notifications (recipient, title, message) VALUES ($1, $2, $3)', [body.recipient || 'All Staff', 'New supervisor message', result.rows[0].message]);
      emitLiveSync('message', result.rows[0]);
      return sendJson(response, 201, result.rows[0]);
    }

    const endorseMatch = url.pathname.match(/^\/api\/supervisor\/requisitions\/([^/]+)\/endorse$/);
    if (endorseMatch && request.method === 'POST') {
      const result = await pool.query('UPDATE requisitions SET endorsed_by = $1, endorsed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING id, name, amount, status, endorsed_by AS "endorsedBy"', ['Davis Okon', endorseMatch[1]]);
      if (!result.rowCount) return sendJson(response, 404, { error: 'Requisition not found' });
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['supervisor_endorsement', `${result.rows[0].id} by Davis Okon`]);
      emitLiveSync('requisition', { id: result.rows[0].id, status: result.rows[0].status, endorsedBy: result.rows[0].endorsedBy });
      return sendJson(response, 200, result.rows[0]);
    }

    const freezeMatch = url.pathname.match(/^\/api\/supervisor\/loans\/([^/]+)\/freeze$/);
    if (freezeMatch && request.method === 'POST') {
      const name = decodeURIComponent(freezeMatch[1]);
      await pool.query('INSERT INTO handheld_locks (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['supervisor_freeze', name]);
      return sendJson(response, 200, { name, frozen: true });
    }

    if (url.pathname === '/api/supervisor/directives' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.audience || !body.message || !body.message.trim()) return sendJson(response, 400, { error: 'Audience and message are required' });
      const result = await pool.query('INSERT INTO directives (sender_name, audience, message) VALUES ($1, $2, $3) RETURNING audience, message, created_at AS at', ['Davis Okon', body.audience, body.message.trim()]);
      const roleFilter = body.audience === 'vsr' ? ['vsr'] : body.audience === 'merch' ? ['merchandiser'] : ['vsr', 'merchandiser'];
      await pool.query('INSERT INTO user_notifications (recipient, title, message) SELECT staff_code, $1, $2 FROM staff WHERE active = TRUE AND role = ANY($3)', ['Supervisor directive', body.message.trim(), roleFilter]);
      emitLiveSync('directive', result.rows[0]);
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/merchandiser/dashboard' && request.method === 'GET') {
      const [audits, actions, checkins, messages] = await Promise.all([
        pool.query('SELECT store_name AS "storeName", sku, shelf_units AS "shelfUnits", intake_units AS "intakeUnits", batch_number AS "batchNumber", expiry_date AS "expiryDate", audited_at AS at FROM stock_audits WHERE staff_code = $1 ORDER BY audited_at DESC LIMIT 25', [user.staffCode]),
        pool.query('SELECT action_type AS "actionType", sku, batch_number AS "batchNumber", created_at AS at FROM stock_actions WHERE staff_code = $1 ORDER BY created_at DESC LIMIT 25', [user.staffCode]),
        pool.query('SELECT store_name AS "storeName", latitude, longitude, radius_match AS "radiusMatch", checked_in_at AS at FROM store_checkins WHERE staff_code = $1 ORDER BY checked_in_at DESC LIMIT 1', [user.staffCode]),
        pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at DESC LIMIT 20', [user.name])
      ]);
      return sendJson(response, 200, { audits: audits.rows, actions: actions.rows, latestCheckin: checkins.rows[0] || null, messages: messages.rows.reverse() });
    }

    if (url.pathname === '/api/merchandiser/messages' && request.method === 'GET') {
      const result = await pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at DESC LIMIT 50', [user.name]);
      return sendJson(response, 200, result.rows.reverse());
    }

    if (url.pathname === '/api/merchandiser/store-checkins/reping' && request.method === 'POST') {
      const body = await readBody(request);
      const result = await pool.query('INSERT INTO store_checkins (staff_code, store_name, latitude, longitude, accuracy_meters) VALUES ($1, $2, $3, $4, $5) RETURNING store_name AS "storeName", latitude, longitude, accuracy_meters AS "accuracyMeters", radius_match AS "radiusMatch", checked_in_at AS at', [user.staffCode, body.storeName || 'Royal Prince Supermarket', body.latitude || null, body.longitude || null, body.accuracyMeters || null]);
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/merchandiser/stock-audits' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.storeName || !body.sku || !body.batchNumber || !body.expiryDate || Number(body.shelfUnits) < 0 || Number(body.intakeUnits) < 0) return sendJson(response, 400, { error: 'Complete stock audit fields are required' });
      const result = await pool.query('INSERT INTO stock_audits (staff_code, store_name, sku, shelf_units, intake_units, batch_number, expiry_date, planogram_compliant) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, audited_at AS at', [user.staffCode, body.storeName, body.sku, Number(body.shelfUnits), Number(body.intakeUnits), body.batchNumber, body.expiryDate, Boolean(body.planogramCompliant)]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['stock_audit', `${body.storeName} ${body.sku}`]);
      emitLiveSync('audit', { staffCode: user.staffCode, storeName: body.storeName, sku: body.sku, at: new Date().toISOString() });
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/merchandiser/stock-actions' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.actionType || !body.sku) return sendJson(response, 400, { error: 'Action type and SKU are required' });
      const result = await pool.query('INSERT INTO stock_actions (staff_code, sku, batch_number, action_type, quantity, source_store, destination_store) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING action_type AS "actionType", sku, batch_number AS "batchNumber", created_at AS at', [user.staffCode, body.sku, body.batchNumber || null, body.actionType, body.quantity || null, body.sourceStore || null, body.destinationStore || null]);
      emitLiveSync('stock-action', { staffCode: user.staffCode, sku: body.sku, actionType: body.actionType, at: new Date().toISOString() });
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/media/uploads' && request.method === 'POST') {
      const body = await readBody(request);
      const match = String(body.dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match || !body.filename) return sendJson(response, 400, { error: 'An image data URL and filename are required' });
      const fileData = Buffer.from(match[2], 'base64');
      if (fileData.length > 5 * 1024 * 1024) return sendJson(response, 413, { error: 'Image must be 5MB or smaller' });
      const result = await pool.query('INSERT INTO media_uploads (staff_code, filename, content_type, related_context, file_data) VALUES ($1, $2, $3, $4, $5) RETURNING id, filename, content_type AS "contentType", created_at AS at', [user.staffCode, body.filename, match[1], body.relatedContext || 'merchandiser-proof', fileData]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['media_upload', `${body.filename} uploaded by ${user.staffCode}`]);
      return sendJson(response, 201, { ...result.rows[0], url: `/api/media/uploads/${result.rows[0].id}` });
    }

    const mediaMatch = url.pathname.match(/^\/api\/media\/uploads\/(\d+)$/);
    if (mediaMatch && request.method === 'GET') {
      const result = await pool.query('SELECT content_type AS "contentType", file_data FROM media_uploads WHERE id = $1', [mediaMatch[1]]);
      if (!result.rowCount) return sendText(response, 404, 'Not found', 'text/plain; charset=utf-8');
      response.writeHead(200, { 'Content-Type': result.rows[0].contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return response.end(result.rows[0].file_data);
    }

    if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') {
      return sendJson(response, 200, await getDashboard());
    }

    if (url.pathname === '/api/admin/audit-log' && request.method === 'GET') {
      const result = await pool.query('SELECT action, detail, created_at AS at FROM audit_log ORDER BY created_at DESC LIMIT 50');
      return sendJson(response, 200, result.rows);
    }

    if (url.pathname === '/api/vsr/dashboard' && request.method === 'GET') {
      const [status, transactions, messages] = await Promise.all([
        pool.query('SELECT vsr_id AS "vsrId", locked, certified_at AS "certifiedAt" FROM vsr_loan_status WHERE vsr_id = $1', [user.staffCode]),
        pool.query('SELECT voucher_id AS "voucherId", customer_name AS "customerName", sku, quantity, amount, settlement_mode AS "settlementMode", created_at AS at FROM vsr_transactions ORDER BY created_at DESC LIMIT 25'),
        pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at ASC LIMIT 50', [user.name])
      ]);
      return sendJson(response, 200, {
        loan: status.rows[0] || { vsrId: 'VSR-784', locked: true, certifiedAt: null },
        transactions: transactions.rows,
        messages: messages.rows
      });
    }

    if (url.pathname === '/api/vsr/messages' && request.method === 'GET') {
      const result = await pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at ASC LIMIT 50', [user.name]);
      return sendJson(response, 200, result.rows);
    }

    if (url.pathname === '/api/vsr/transactions' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.customerName || !body.sku || !Number.isInteger(Number(body.quantity)) || Number(body.quantity) <= 0 || !body.amount || !['bank', 'credit'].includes(body.settlementMode)) {
        return sendJson(response, 400, { error: 'Customer, SKU, positive quantity, amount, and settlement mode are required' });
      }
      if (body.settlementMode === 'credit' && !body.customerContact) {
        return sendJson(response, 400, { error: 'Customer contact is required for credit sales' });
      }
      const voucherId = `TX-${Date.now()}`;
      const result = await pool.query(
        'INSERT INTO vsr_transactions (voucher_id, customer_name, sku, quantity, amount, settlement_mode, customer_contact) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING voucher_id AS "voucherId", created_at AS at',
        [voucherId, body.customerName, body.sku, Number(body.quantity), body.amount, body.settlementMode, body.customerContact || null]
      );
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['vsr_transaction', `${voucherId} ${body.customerName} ${body.settlementMode}`]);
      emitLiveSync('voucher', { voucherId, customerName: body.customerName, settlementMode: body.settlementMode, at: new Date().toISOString() });
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/vsr/settlement/certify' && request.method === 'POST') {
      const result = await pool.query('UPDATE vsr_loan_status SET locked = FALSE, certified_at = NOW() WHERE vsr_id = $1 RETURNING vsr_id AS "vsrId", locked, certified_at AS "certifiedAt"', ['VSR-784']);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['vsr_lock_certified', 'VSR-784 certified by Joint Accountant Desk']);
      emitLiveSync('vsr-lock', { vsrId: 'VSR-784', locked: false, at: new Date().toISOString() });
      return sendJson(response, 200, result.rows[0]);
    }

    if (url.pathname === '/api/vsr/messages' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.message || !body.message.trim()) return sendJson(response, 400, { error: 'Message is required' });
      const result = await pool.query('INSERT INTO supervisor_messages (sender, recipient, message) VALUES ($1, $2, $3) RETURNING sender, recipient, message, created_at AS at', [user.name, body.recipient || 'Davis Okon', body.message.trim()]);
      await pool.query('INSERT INTO user_notifications (recipient, title, message) VALUES ($1, $2, $3)', [body.recipient || 'Davis Okon', 'New VSR message', result.rows[0].message]);
      emitLiveSync('message', result.rows[0]);
      return sendJson(response, 201, result.rows[0]);
    }

    const requisitionMatch = url.pathname.match(/^\/api\/admin\/requisitions\/([^/]+)\/decision$/);
    if (requisitionMatch && request.method === 'POST') {
      const body = await readBody(request);
      if (!['approved', 'rejected'].includes(body.decision)) {
        return sendJson(response, 400, { error: 'Decision must be approved or rejected' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('UPDATE requisitions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, amount, status', [body.decision, requisitionMatch[1]]);
        if (!result.rowCount) {
          await client.query('ROLLBACK');
          return sendJson(response, 404, { error: 'Requisition not found' });
        }
        const requisition = result.rows[0];
        await recordAudit(client, `requisition_${body.decision}`, `${requisition.name} ${requisition.amount}`);
        await client.query('COMMIT');
        return sendJson(response, 200, requisition);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    const lockMatch = url.pathname.match(/^\/api\/admin\/loans\/([^/]+)\/lock$/);
    if (lockMatch && request.method === 'POST') {
      const name = decodeURIComponent(lockMatch[1]);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('INSERT INTO handheld_locks (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
        await recordAudit(client, 'handheld_lock', name);
        await client.query('COMMIT');
        return sendJson(response, 200, { name, locked: true });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    serveStatic(request, response, url.pathname, user);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`KEA operations API running at http://localhost:${port}`);
});
