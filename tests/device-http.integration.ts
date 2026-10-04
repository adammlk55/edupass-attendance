import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { AddressInfo } from 'node:net';

// Actual Next HTTP routes + actual SQL. Only the hosted PostgREST transport is emulated.
test('HTTP device routes → Supabase client → local PostgreSQL', { timeout: 90000 }, async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`,
  );
  await db.exec(readFileSync('supabase/schema.sql', 'utf8'));
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const date = new Date(Date.now() - 86400000);
  date.setUTCHours(8, 0, 2, 0);
  await db.exec(
    `update public.settings set timezone='UTC';update public.timetable set day_of_week=${date.getUTCDay() || 7};`,
  );
  const key = 'a'.repeat(64);
  const device = '10000000-0000-4000-8000-000000000007';
  await db.query('select public.set_device_key($1,$2)', [
    device,
    createHash('sha256').update(key).digest('hex'),
  ]);
  const signatures: Record<string, string[]> = {
    device_auth: ['p_code', 'p_hash'],
    device_sync: ['p_device', 'p_mode', 'p_version', 'p_force', 'p_pending'],
    device_open_session: ['p_device', 'p_card', 'p_timestamp', 'p_local_id', 'p_version'],
    device_attendance: ['p_device', 'p_record'],
  };
  const adapter = createServer(async (req, res) => {
    try {
      if (req.headers.authorization !== 'Bearer local-test-service') {
        res.writeHead(401);
        res.end('{}');
        return;
      }
      const fn = req.url?.split('/').pop() ?? '';
      if (!signatures[fn]) {
        res.writeHead(404);
        res.end('{}');
        return;
      }
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      const keys = signatures[fn].filter((k) => k in body);
      const result = await db.query<{ value: unknown }>(
        `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) as value`,
        keys.map((k) => body[k]),
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows[0].value));
    } catch (e) {
      const err = e as { message: string; code: string };
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: err.message, code: err.code }));
    }
  });
  await new Promise<void>((r) => adapter.listen(0, '127.0.0.1', r));
  t.after(() => new Promise<void>((r) => adapter.close(() => r())));
  const adapterUrl = `http://127.0.0.1:${(adapter.address() as AddressInfo).port}`;
  const portProbe = createServer();
  await new Promise<void>((r) => portProbe.listen(0, '127.0.0.1', r));
  const port = (portProbe.address() as AddressInfo).port;
  await new Promise<void>((r) => portProbe.close(() => r()));
  const app = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      env: {
        ...process.env,
        EDUPASS_DEMO_MODE: 'false',
        NEXT_PUBLIC_SUPABASE_URL: adapterUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-test-public',
        SUPABASE_SERVICE_ROLE_KEY: 'local-test-service',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  t.after(() => {
    app.kill();
  });
  let output = '';
  app.stdout.on('data', (b) => (output += b));
  app.stderr.on('data', (b) => (output += b));
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(timer);
      reject(new Error(output));
    }, 20000);
    const timer = setInterval(() => {
      if (output.includes('Ready')) {
        clearInterval(timer);
        clearTimeout(timeout);
        resolve();
      } else if (app.exitCode !== null) {
        clearInterval(timer);
        clearTimeout(timeout);
        reject(new Error(output));
      }
    }, 100);
  });
  const base = `http://127.0.0.1:${port}/api/device/`;
  async function request(path: string, body?: unknown, token = key) {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Device-Key': token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  }
  await t.test('authentication is mandatory and bound to device code', async () => {
    assert.equal(
      (await request('sync/check?device_code=DEVICE_012&version=0', undefined, '')).status,
      401,
    );
    assert.equal((await request('sync/check?device_code=WRONG&version=0')).status, 401);
    assert.equal((await request('sync/check?device_code=DEVICE_012&version=-1')).status, 400);
  });
  let v = 0;
  await t.test('full sync and ack pass through real route handlers', async () => {
    const full = await request('sync/full?device_code=DEVICE_012');
    assert.equal(full.status, 200);
    assert.equal(full.body.students.length, 2);
    v = full.body.version;
    assert.equal(
      (
        await request('sync/ack', {
          device_code: 'DEVICE_012',
          version: v,
          force_sync_id: null,
          pending_uploads: 0,
        })
      ).status,
      200,
    );
  });
  await t.test('session open, partial bulk results and duplicate retry', async () => {
    const opened = await request('session/open', {
      device_code: 'DEVICE_012',
      teacher_card_uid: 'PROF_001',
      timestamp: date.toISOString(),
      session_local_id: 'http-session',
      data_version: v,
    });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert(opened.body.session.id);
    const record = {
      local_id: 'http-scan',
      session_local_id: 'http-session',
      student_card_uid: 'CARD_001',
      scanned_at: new Date(date.getTime() + 60000).toISOString(),
      source: 'nfc',
    };
    const partial = await request('attendance/bulk', {
      device_code: 'DEVICE_012',
      records: [record, { ...record, local_id: 'bad-scan', student_card_uid: 'UNKNOWN' }],
    });
    assert.equal(partial.status, 207);
    assert.equal(partial.body.results[0].ok, true);
    assert.equal(partial.body.results[1].error, 'STUDENT_NOT_IN_CLASS');
    const retry = await request('attendance/bulk', {
      device_code: 'DEVICE_012',
      records: [record],
    });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.results[0].duplicate, true);
    const count = await db.query<{ n: number }>('select count(*)::int as n from public.attendance');
    assert.equal(count.rows[0].n, 1);
  });
  await t.test('invalid bodies and browser-origin checks fail safely', async () => {
    const malformed = await fetch(base + 'attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    assert.equal(malformed.status, 400);
    const oversized = await fetch(base + 'attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(140000) }),
    });
    assert.equal(oversized.status, 413);
    const admin = await fetch(`http://127.0.0.1:${port}/api/admin/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.invalid' },
      body: '{}',
    });
    assert.equal(admin.status, 403);
  });
});
