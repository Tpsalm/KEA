const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { Pool } = require('pg');

const rootDir = __dirname;
const port = Number(process.env.PORT || 4173);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting the server.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
  const requestedPath = pathname === '/' ? 'kea_portal_mobile_shift_clock_in_gateway/code.html' : pathname.slice(1);
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
      await pool.query('SELECT 1');
      return sendJson(response, 200, { status: 'ok' });
    }

    if (url.pathname === '/api/admin/dashboard' && request.method === 'GET') {
      return sendJson(response, 200, await getDashboard());
    }

    if (url.pathname === '/api/admin/audit-log' && request.method === 'GET') {
      const result = await pool.query('SELECT action, detail, created_at AS at FROM audit_log ORDER BY created_at DESC LIMIT 50');
      return sendJson(response, 200, result.rows);
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
