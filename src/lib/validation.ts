import { z } from 'zod';
const text = z
  .string()
  .trim()
  .min(1, 'Ce champ est obligatoire.')
  .max(120, '120 caractères maximum.');
const uid = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9:_-]+$/)
  .transform((v) => v.toUpperCase());
const card = uid.nullable();
const uuid = z.uuid();
const active = z.boolean();
const person = { first_name: text, last_name: text, card_uid: card, active };
export const entitySchemas = {
  students: z.object({
    ...person,
    massar_code: text,
    class_id: uuid,
    photo_url: z.url().max(2048).nullable().optional(),
  }),
  teachers: z.object({ ...person, teacher_code: text }),
  classes: z.object({ name: text, academic_year: z.string().regex(/^\d{4}-\d{4}$/), active }),
  subjects: z.object({ name: text, code: text, active }),
  rooms: z.object({
    name: text,
    building: z.string().max(120).nullable(),
    floor: z.number().int().min(-5).max(100).nullable(),
    active,
  }),
  devices: z.object({ name: text, device_code: uid, room_id: uuid, active }),
  timetable: z
    .object({
      teacher_id: uuid,
      subject_id: uuid,
      class_id: uuid,
      room_id: uuid,
      day_of_week: z.number().int().min(1).max(7),
      start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      active,
    })
    .refine((v) => v.start_time < v.end_time, { message: 'La fin doit être après le début.' }),
  settings: z.object({
    school_name: text,
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat('fr', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
    late_minutes: z.number().int().min(0).max(60),
  }),
};
export const deviceCode = uid;
export const version = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const openSessionSchema = z.object({
  device_code: uid,
  teacher_card_uid: uid,
  timestamp: z.iso.datetime({ offset: true }),
  session_local_id: text.optional(),
  data_version: version.optional(),
});
export const attendanceRecord = z
  .object({
    local_id: text.optional(),
    session_id: uuid.optional(),
    session_local_id: text.optional(),
    student_card_uid: uid,
    scanned_at: z.iso.datetime({ offset: true }),
    source: z.enum(['nfc', 'mobile_ble']).default('nfc'),
    status: z.enum(['present', 'late']).optional(),
  })
  .refine((v) => Boolean(v.session_id) !== Boolean(v.session_local_id), {
    message: 'Exactly one session identifier is required',
  });
export const singleAttendanceSchema = z.object({ device_code: uid }).and(attendanceRecord);
export const bulkSchema = z.object({
  device_code: uid,
  records: z
    .array(attendanceRecord.refine((v) => !!v.local_id, { message: 'local_id required' }))
    .min(1)
    .max(100),
});
