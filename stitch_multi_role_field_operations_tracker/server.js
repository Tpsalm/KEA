require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
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

function serveStatic(request, response, pathname) {
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

    if (url.pathname === '/api/attendance/today' && request.method === 'GET') {
      const result = await pool.query('SELECT staff_code AS "staffCode", role, hub, clocked_in_at AS at FROM shift_clock_ins WHERE clocked_in_at::date = CURRENT_DATE ORDER BY clocked_in_at DESC');
      return sendJson(response, 200, result.rows);
    }

    if (url.pathname === '/api/auth/clock-in' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.staffId || !body.passcode || !['supervisor', 'vsr', 'merchandiser'].includes(body.role)) {
        return sendJson(response, 400, { error: 'Staff ID, passcode, and role are required' });
      }
      const staffResult = await pool.query('SELECT id, staff_code AS "staffCode", name, role, hub FROM staff WHERE (staff_code = $1 OR email = $1) AND role = $2 AND active = TRUE', [body.staffId, body.role]);
      const staff = staffResult.rows[0];
      if (!staff) return sendJson(response, 401, { error: 'Staff credentials or role are not authorized' });
      const result = await pool.query('INSERT INTO shift_clock_ins (staff_id, staff_code, role, hub, latitude, longitude, accuracy_meters, telemetry_json) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING clocked_in_at AS at', [staff.id, staff.staffCode, staff.role, body.hub || staff.hub, body.latitude || null, body.longitude || null, body.accuracyMeters || null, body.telemetry || {}]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['shift_clock_in', `${staff.staffCode} ${staff.role}`]);
      return sendJson(response, 201, { staff, clockIn: result.rows[0], destination: `/${staff.role === 'vsr' ? 'vsr_field_terminal_mobile_sales_credit' : staff.role === 'merchandiser' ? 'merchandiser_hub_mobile_stock_expiry' : 'supervisor_operations_hub_mobile'}/code.html` });
    }

    if (url.pathname === '/api/supervisor/dashboard' && request.method === 'GET') {
      const [staff, directives, actions] = await Promise.all([
        pool.query('SELECT staff_code AS "staffCode", name, role, region, hub FROM staff WHERE active = TRUE ORDER BY role, name'),
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
      const result = await pool.query('INSERT INTO supervisor_messages (sender, recipient, message) VALUES ($1, $2, $3) RETURNING sender, recipient, message, created_at AS at', [body.sender || 'Davis Okon', body.recipient || 'All Staff', body.message.trim()]);
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
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/merchandiser/dashboard' && request.method === 'GET') {
      const [audits, actions, checkins, messages] = await Promise.all([
        pool.query('SELECT store_name AS "storeName", sku, shelf_units AS "shelfUnits", intake_units AS "intakeUnits", batch_number AS "batchNumber", expiry_date AS "expiryDate", audited_at AS at FROM stock_audits WHERE staff_code = $1 ORDER BY audited_at DESC LIMIT 25', ['M0001']),
        pool.query('SELECT action_type AS "actionType", sku, batch_number AS "batchNumber", created_at AS at FROM stock_actions WHERE staff_code = $1 ORDER BY created_at DESC LIMIT 25', ['M0001']),
        pool.query('SELECT store_name AS "storeName", latitude, longitude, radius_match AS "radiusMatch", checked_in_at AS at FROM store_checkins WHERE staff_code = $1 ORDER BY checked_in_at DESC LIMIT 1', ['M0001']),
        pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at DESC LIMIT 20', ['Kenji Sato'])
      ]);
      return sendJson(response, 200, { audits: audits.rows, actions: actions.rows, latestCheckin: checkins.rows[0] || null, messages: messages.rows.reverse() });
    }

    if (url.pathname === '/api/merchandiser/messages' && request.method === 'GET') {
      const result = await pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at DESC LIMIT 50', ['Kenji Sato']);
      return sendJson(response, 200, result.rows.reverse());
    }

    if (url.pathname === '/api/merchandiser/store-checkins/reping' && request.method === 'POST') {
      const body = await readBody(request);
      const result = await pool.query('INSERT INTO store_checkins (staff_code, store_name, latitude, longitude, accuracy_meters) VALUES ($1, $2, $3, $4, $5) RETURNING store_name AS "storeName", latitude, longitude, accuracy_meters AS "accuracyMeters", radius_match AS "radiusMatch", checked_in_at AS at', ['M0001', body.storeName || 'Royal Prince Supermarket', body.latitude || null, body.longitude || null, body.accuracyMeters || null]);
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/merchandiser/stock-audits' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.storeName || !body.sku || !body.batchNumber || !body.expiryDate || Number(body.shelfUnits) < 0 || Number(body.intakeUnits) < 0) return sendJson(response, 400, { error: 'Complete stock audit fields are required' });
      const result = await pool.query('INSERT INTO stock_audits (staff_code, store_name, sku, shelf_units, intake_units, batch_number, expiry_date, planogram_compliant) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, audited_at AS at', ['M0001', body.storeName, body.sku, Number(body.shelfUnits), Number(body.intakeUnits), body.batchNumber, body.expiryDate, Boolean(body.planogramCompliant)]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['stock_audit', `${body.storeName} ${body.sku}`]);
      emitLiveSync('audit', { staffCode: 'M0001', storeName: body.storeName, sku: body.sku, at: new Date().toISOString() });
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/merchandiser/stock-actions' && request.method === 'POST') {
      const body = await readBody(request);
      if (!body.actionType || !body.sku) return sendJson(response, 400, { error: 'Action type and SKU are required' });
      const result = await pool.query('INSERT INTO stock_actions (staff_code, sku, batch_number, action_type, quantity, source_store, destination_store) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING action_type AS "actionType", sku, batch_number AS "batchNumber", created_at AS at', ['M0001', body.sku, body.batchNumber || null, body.actionType, body.quantity || null, body.sourceStore || null, body.destinationStore || null]);
      emitLiveSync('stock-action', { staffCode: 'M0001', sku: body.sku, actionType: body.actionType, at: new Date().toISOString() });
      return sendJson(response, 201, result.rows[0]);
    }

    if (url.pathname === '/api/media/uploads' && request.method === 'POST') {
      const body = await readBody(request);
      const match = String(body.dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match || !body.filename) return sendJson(response, 400, { error: 'An image data URL and filename are required' });
      const fileData = Buffer.from(match[2], 'base64');
      if (fileData.length > 5 * 1024 * 1024) return sendJson(response, 413, { error: 'Image must be 5MB or smaller' });
      const result = await pool.query('INSERT INTO media_uploads (staff_code, filename, content_type, related_context, file_data) VALUES ($1, $2, $3, $4, $5) RETURNING id, filename, content_type AS "contentType", created_at AS at', ['M0001', body.filename, match[1], body.relatedContext || 'merchandiser-proof', fileData]);
      await pool.query('INSERT INTO audit_log (action, detail) VALUES ($1, $2)', ['media_upload', `${body.filename} uploaded by M0001`]);
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
        pool.query('SELECT vsr_id AS "vsrId", locked, certified_at AS "certifiedAt" FROM vsr_loan_status WHERE vsr_id = $1', ['VSR-784']),
        pool.query('SELECT voucher_id AS "voucherId", customer_name AS "customerName", sku, quantity, amount, settlement_mode AS "settlementMode", created_at AS at FROM vsr_transactions ORDER BY created_at DESC LIMIT 25'),
        pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at ASC LIMIT 50', ['Davis Okon'])
      ]);
      return sendJson(response, 200, {
        loan: status.rows[0] || { vsrId: 'VSR-784', locked: true, certifiedAt: null },
        transactions: transactions.rows,
        messages: messages.rows
      });
    }

    if (url.pathname === '/api/vsr/messages' && request.method === 'GET') {
      const result = await pool.query('SELECT sender, recipient, message, created_at AS at FROM supervisor_messages WHERE recipient = $1 OR sender = $1 ORDER BY created_at ASC LIMIT 50', ['Davis Okon']);
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
      const result = await pool.query('INSERT INTO supervisor_messages (sender, recipient, message) VALUES ($1, $2, $3) RETURNING sender, recipient, message, created_at AS at', ['Sulaimon', 'Davis Okon', body.message.trim()]);
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

    serveStatic(request, response, url.pathname);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`KEA operations API running at http://localhost:${port}`);
});
