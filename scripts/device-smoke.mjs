// Uses only device credentials, never a Supabase service key.
const base = process.env.EDUPASS_URL;
const code = process.env.DEVICE_CODE;
const key = process.env.DEVICE_KEY;
const stamp = process.env.SCAN_TIMESTAMP;
if (!base || !code || !key || !stamp)
  throw new Error(
    'Set EDUPASS_URL, DEVICE_CODE, DEVICE_KEY and SCAN_TIMESTAMP (ISO instant inside a configured lesson).',
  );
if (Number.isNaN(Date.parse(stamp))) throw new Error('SCAN_TIMESTAMP must be an ISO timestamp.');
async function request(path, body) {
  const response = await fetch(new URL(`/api/device/${path}`, base), {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Device-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify({ device_code: code, ...body }) : undefined,
  });
  const value = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(value)}`);
  return value;
}
const cache = await request(`sync/full?device_code=${encodeURIComponent(code)}`);
console.log('Cache received:', cache.version, 'students:', cache.students.length);
// This smoke client keeps the cache in memory. Real firmware must persist it before ACK.
await request('sync/ack', {
  version: cache.version,
  force_sync_id: cache.force_sync_id,
  pending_uploads: 0,
});
const local = `smoke:${stamp}:v${cache.version}`;
const opened = await request('session/open', {
  teacher_card_uid: process.env.TEACHER_CARD ?? 'PROF_001',
  timestamp: stamp,
  session_local_id: local,
  data_version: cache.version,
});
console.log('Session:', opened.session.id);
const records = [
  {
    local_id: `${local}:scan1`,
    session_local_id: local,
    student_card_uid: process.env.STUDENT_CARD ?? 'CARD_001',
    scanned_at: new Date(Date.parse(stamp) + 30_000).toISOString(),
    source: 'nfc',
  },
];
const first = await request('attendance/bulk', { records });
if (!first.ok) throw new Error(JSON.stringify(first));
const retry = await request('attendance/bulk', { records });
if (
  !retry.ok ||
  !retry.results[0].duplicate ||
  first.results[0].attendance_id !== retry.results[0].attendance_id
)
  throw new Error('Idempotency verification failed.');
console.log('Attendance:', first.results[0].status, '— retry returned the same record.');
console.log('Check the Présences screen; it refreshes within five seconds.');
