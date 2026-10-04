import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test('PostgreSQL: complete school / offline device lifecycle', async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  await db.exec(readFileSync('supabase/schema.sql', 'utf8'));
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  async function rpc<T = Record<string, unknown>>(name: string, params: unknown[]): Promise<T> {
    const result = await db.query<{ result: T }>(
      `select public.${name}(${params.map((_, i) => `$${i + 1}`).join(',')}) as result`,
      params,
    );
    return result.rows[0].result;
  }
  const previousDay = new Date(Date.now() - 86400000);
  previousDay.setUTCHours(8, 0, 2, 0);
  const stamp = previousDay.toISOString();
  const day = previousDay.getUTCDay() || 7;
  await db.exec(
    `update public.settings set timezone='UTC'; update public.timetable set day_of_week=${day}`,
  );
  let initialVersion = 0;
  let session = '';
  await t.test('device authentication and key separation', async () => {
    await rpc('set_device_key', [id(7), 'hash-one']);
    assert.equal(await rpc('device_auth', ['DEVICE_012', 'wrong']), null);
    assert.equal(await rpc('device_auth', ['DEVICE_012', 'hash-one']), id(7));
    const r = await db.query<Record<string, unknown>>(
      `select has_table_privilege('authenticated','private.device_keys','SELECT') as allowed`,
    );
    assert.equal(r.rows[0].allowed, false);
  });
  await t.test('full sync is scoped, and download is not an acknowledgement', async () => {
    const b = await rpc<any>('device_sync', [id(7), 'full', 0]);
    initialVersion = b.version;
    assert.equal(b.students.length, 2);
    assert.equal(b.teachers.length, 1);
    assert.equal(b.device.device_code, 'DEVICE_012');
    assert.equal(JSON.stringify(b).includes('hash-one'), false);
    const rows = await db.query<Record<string, unknown>>(`select last_sync_at from public.devices`);
    assert.equal(rows.rows[0].last_sync_at, null);
    await rpc('device_sync', [id(7), 'ack', initialVersion, null, 3]);
    const after = await db.query<Record<string, unknown>>(
      `select pending_uploads,local_data_version from public.devices`,
    );
    assert.equal(after.rows[0].pending_uploads, 3);
    assert.equal(Number(after.rows[0].local_data_version), initialVersion);
  });
  await t.test('schedule overlap is rejected, adjacent periods allowed', async () => {
    await assert.rejects(
      db.exec(
        `insert into public.timetable(teacher_id,subject_id,class_id,room_id,day_of_week,start_time,end_time) select teacher_id,subject_id,class_id,room_id,day_of_week,'08:30','09:30' from public.timetable limit 1`,
      ),
      /TIMETABLE_CONFLICT/,
    );
    await db.exec(
      `insert into public.timetable(teacher_id,subject_id,class_id,room_id,day_of_week,start_time,end_time) select teacher_id,subject_id,class_id,room_id,day_of_week,'09:00','10:00' from public.timetable limit 1`,
    );
  });
  await t.test('NFC cards cannot identify both a teacher and a student', async () => {
    await assert.rejects(
      db.exec(`update public.students set card_uid='prof_001' where id='${id(5)}'`),
      /CARD_ALREADY_ASSIGNED/,
    );
  });
  await t.test(
    'offline session opens from historical configuration and retries safely',
    async () => {
      const r = await rpc<any>('device_open_session', [
        id(7),
        'PROF_001',
        stamp,
        'lesson-1',
        initialVersion,
      ]);
      session = r.session.id;
      const again = await rpc<any>('device_open_session', [
        id(7),
        'PROF_001',
        stamp,
        'lesson-1',
        initialVersion,
      ]);
      assert.equal(again.session.id, session);
      await assert.rejects(
        rpc('device_open_session', [id(7), 'BAD', stamp, 'lesson-1', initialVersion]),
        /LOCAL_ID_CONFLICT/,
      );
      const roster = await db.query<Record<string, unknown>>(
        `select count(*)::int as n from public.session_students`,
      );
      assert.equal(roster.rows[0].n, 2);
    },
  );
  await t.test('absence generation and delayed uploads reconcile without duplicates', async () => {
    assert.equal(await rpc('finalize_sessions', []), 1);
    const scan = {
      local_id: 'scan-1',
      session_local_id: 'lesson-1',
      student_card_uid: 'CARD_001',
      scanned_at: new Date(previousDay.getTime() + 4 * 60000).toISOString(),
      source: 'nfc',
    };
    const r = await rpc<any>('device_attendance', [id(7), scan]);
    assert.equal(r.status, 'present');
    const repeated = await rpc<any>('device_attendance', [id(7), scan]);
    assert.equal(repeated.duplicate, true);
    assert.equal(repeated.attendance_id, r.attendance_id);
    await assert.rejects(
      rpc('device_attendance', [id(7), { ...scan, student_card_uid: 'CARD_002' }]),
      /LOCAL_ID_CONFLICT/,
    );
    await assert.rejects(
      rpc('device_attendance', [id(7), { ...scan, local_id: 'wrong', student_card_uid: 'OTHER' }]),
      /STUDENT_NOT_IN_CLASS/,
    );
    const late = await rpc<any>('device_attendance', [
      id(7),
      {
        ...scan,
        local_id: 'scan-2',
        student_card_uid: 'CARD_002',
        scanned_at: new Date(previousDay.getTime() + 11 * 60000).toISOString(),
      },
    ]);
    assert.equal(late.status, 'late');
    const rows = await db.query<Record<string, unknown>>(
      `select count(*)::int as n from public.attendance`,
    );
    assert.equal(rows.rows[0].n, 2);
  });
  await t.test('exact ten minute boundary and earliest scan win', async () => {
    const atBoundary = new Date(previousDay);
    atBoundary.setUTCMinutes(10, 0, 0);
    const r = await rpc<any>('device_attendance', [
      id(7),
      {
        session_id: session,
        student_card_uid: 'CARD_002',
        scanned_at: atBoundary.toISOString(),
        source: 'nfc',
      },
    ]);
    assert.equal(r.status, 'present');
    await assert.rejects(
      rpc('device_attendance', [
        id(7),
        {
          session_id: session,
          student_card_uid: 'CARD_002',
          scanned_at: new Date(previousDay.getTime() + 60 * 60000).toISOString(),
          source: 'nfc',
        },
      ]),
      /INVALID_TIMESTAMP/,
    );
  });
  await t.test(
    'class moves produce scoped deletion, historical roster remains usable',
    async () => {
      await db.exec(
        `insert into public.classes(id,name,academic_year) values('${id(9)}','Other','2026-2027'); update public.students set class_id='${id(9)}' where id='${id(5)}'`,
      );
      const delta = await rpc<any>('device_sync', [id(7), 'changes', initialVersion]);
      assert(delta.changes.some((c: any) => c.entity_id === id(5) && c.action === 'delete'));
      assert(!delta.changes.some((c: any) => c.entity_id === id(9)));
      const r = await rpc<any>('device_attendance', [
        id(7),
        {
          session_id: session,
          student_card_uid: 'CARD_001',
          scanned_at: new Date(previousDay.getTime() + 3 * 60000).toISOString(),
          source: 'nfc',
        },
      ]);
      assert.equal(r.status, 'present');
      const full = await rpc<any>('device_sync', [id(7), 'full', 0]);
      assert.equal(full.students.length, 1);
    },
  );
  await t.test('forced sync cannot be cleared by an older acknowledgement', async () => {
    const force = '20000000-0000-4000-8000-000000000001';
    await db.query('update public.devices set force_sync_id=$1 where id=$2', [force, id(7)]);
    await rpc('device_sync', [id(7), 'ack', initialVersion, null, 0]);
    const c = await rpc<any>('device_sync', [id(7), 'check', initialVersion]);
    assert.equal(c.force_full_sync, true);
    const full = await rpc<any>('device_sync', [id(7), 'full', 0]);
    await rpc('device_sync', [id(7), 'ack', full.version, force, 0]);
    assert.equal(
      (await rpc<any>('device_sync', [id(7), 'check', full.version])).force_full_sync,
      false,
    );
  });
  await t.test('manual excuse survives subsequent legitimate device uploads', async () => {
    await db.exec(
      `update public.attendance set status='excused',source='manual_admin' where student_id='${id(6)}'`,
    );
    const r = await rpc<any>('device_attendance', [
      id(7),
      {
        session_id: session,
        student_card_uid: 'CARD_002',
        scanned_at: new Date(previousDay.getTime() + 4 * 60000).toISOString(),
        source: 'nfc',
      },
    ]);
    assert.equal(r.status, 'excused');
  });
  await t.test(
    'service role can execute device workflow with private tables protected',
    async () => {
      await db.exec('set role service_role');
      assert.equal(await rpc('device_auth', ['DEVICE_012', 'hash-one']), id(7));
      const r = await rpc<any>('device_sync', [id(7), 'full', 0]);
      assert.equal(r.device.device_code, 'DEVICE_012');
      await db.exec('reset role');
    },
  );
  await t.test('staff data and device RPCs are denied to anonymous/unapproved users', async () => {
    await db.exec('set role authenticated');
    const rows = await db.query('select * from public.students');
    assert.equal(rows.rows.length, 0);
    await assert.rejects(rpc('device_auth', ['DEVICE_012', 'hash-one']), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.students'), /permission denied/);
    await db.exec('reset role');
  });
  await t.test('approved staff read data; only an admin can edit and advance versions', async () => {
    await db.exec(`insert into auth.users values('${id(20)}'),('${id(21)}');
      insert into public.users(id,full_name,role) values('${id(20)}','Staff','staff'),('${id(21)}','Admin','admin');`);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(20)}',false);`);
    assert.equal((await db.query('select * from public.students')).rows.length,2);
    const unchanged=await db.query(`update public.students set last_name='Not allowed' where id='${id(5)}' returning id`);
    assert.equal(unchanged.rows.length,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${id(21)}',false);`);
    const before=await db.query<{version:number}>('select version from public.sync_versions');
    await db.exec(`update public.students set last_name='Updated' where id='${id(5)}'`);
    const after=await db.query<{version:number}>('select version from public.sync_versions');
    assert.equal(Number(after.rows[0].version),Number(before.rows[0].version)+1);
    await db.exec('reset role');
  });
  await db.close();
});
