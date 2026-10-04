import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceRecord,
  bulkSchema,
  entitySchemas,
  openSessionSchema,
} from '../src/lib/validation';
test('device validation rejects ambiguous sessions, manual source and malformed timestamps', () => {
  const base = {
    student_card_uid: 'card_001',
    scanned_at: '2026-10-04T08:01:00Z',
    session_local_id: 'one',
  };
  assert.equal(attendanceRecord.parse(base).student_card_uid, 'CARD_001');
  assert.equal(attendanceRecord.safeParse({ ...base, source: 'manual_admin' }).success, false);
  assert.equal(
    attendanceRecord.safeParse({ ...base, session_id: '10000000-0000-4000-8000-000000000001' })
      .success,
    false,
  );
  assert.equal(attendanceRecord.safeParse({ ...base, scanned_at: 'tomorrow' }).success, false);
  assert.equal(bulkSchema.safeParse({ device_code: 'DEVICE_012', records: [base] }).success, false);
  assert.equal(
    bulkSchema.safeParse({
      device_code: 'DEVICE_012',
      records: Array.from({ length: 101 }, () => ({ ...base, local_id: 'x' })),
    }).success,
    false,
  );
  assert.equal(
    openSessionSchema.safeParse({
      device_code: 'x',
      teacher_card_uid: 'p',
      timestamp: '2026-10-04T08:00:00Z',
      data_version: -1,
    }).success,
    false,
  );
});
test('school settings reject invalid timezone and lateness thresholds', () => {
  assert.equal(
    entitySchemas.settings.safeParse({
      school_name: 'School',
      timezone: 'Mars/Olympus',
      late_minutes: 10,
    }).success,
    false,
  );
  assert.equal(
    entitySchemas.settings.safeParse({
      school_name: 'School',
      timezone: 'Africa/Casablanca',
      late_minutes: 61,
    }).success,
    false,
  );
});
