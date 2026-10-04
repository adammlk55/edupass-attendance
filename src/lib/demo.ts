import type { Row, SchoolData } from './types';
import { withClock } from './clock';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function demoData(): SchoolData {
  const classes: Row[] = ['2BAC STE 1', '2BAC STE 2', '1BAC STE', '2BAC SM A'].map((name, i) => ({
    id: id(i + 1),
    name,
    academic_year: '2026-2027',
    active: true,
  }));
  const teachers: Row[] = [
    ['Ahmed', 'Bennani'],
    ['Nadia', 'El Amrani'],
    ['Youssef', 'Alaoui'],
    ['Fatima', 'Idrissi'],
  ].map(([first_name, last_name], i) => ({
    id: id(i + 10),
    first_name,
    last_name,
    teacher_code: `ENS-${String(i + 1).padStart(3, '0')}`,
    card_uid: `PROF_00${i + 1}`,
    active: true,
  }));
  const subjects: Row[] = [
    'Mathématiques',
    'Sciences physiques',
    'Sciences de l’ingénieur',
    'Français',
  ].map((name, i) => ({
    id: id(i + 20),
    name,
    code: ['MATH', 'PHY', 'SI', 'FR'][i],
    active: true,
  }));
  const rooms: Row[] = ['Salle 12', 'Salle 14', 'Laboratoire 01', 'Salle 08'].map((name, i) => ({
    id: id(i + 30),
    name,
    building: i < 2 ? 'Bâtiment A' : 'Bâtiment B',
    floor: i < 2 ? 1 : 0,
    active: true,
  }));
  const first = [
    'Yassine',
    'Salma',
    'Adam',
    'Inès',
    'Omar',
    'Lina',
    'Amine',
    'Aya',
    'Mehdi',
    'Nour',
    'Hamza',
    'Sara',
  ];
  const last = [
    'El Mansouri',
    'Bennani',
    'Alaoui',
    'Idrissi',
    'Berrada',
    'El Fassi',
    'Amrani',
    'Tazi',
  ];
  const students: Row[] = Array.from({ length: 48 }, (_, i) => ({
    id: id(100 + i),
    first_name: first[i % 12],
    last_name: last[(i + Math.floor(i / 12)) % 8],
    massar_code: i === 0 ? 'M13562489' : i === 1 ? 'M24871953' : `M${13562489 + i * 1423}`,
    card_uid: `CARD_${String(i + 1).padStart(3, '0')}`,
    class_id: classes[Math.floor(i / 12)].id,
    active: true,
    photo_url: null,
  }));
  const devices: Row[] = rooms.map((r, i) => ({
    id: id(40 + i),
    name: `Borne ${r.name}`,
    device_code: `DEVICE_0${12 + i}`,
    room_id: r.id,
    active: true,
    firmware_version: '1.0.0',
    last_seen_at: i === 3 ? '2026-10-05T07:12:00Z' : '2026-10-05T09:41:30Z',
    last_sync_at: i > 1 ? '2026-10-01T06:00:00Z' : '2026-10-05T06:00:00Z',
    local_data_version: i > 1 ? 1038 : 1042,
    force_sync_id: null,
    pending_uploads: i === 3 ? 6 : 0,
    status: i === 3 ? 'offline' : 'online',
  }));
  const timetable: Row[] = Array.from({ length: 20 }, (_, i) => ({
    id: id(200 + i),
    teacher_id: teachers[i % 4].id,
    subject_id: subjects[i % 4].id,
    class_id: classes[i % 4].id,
    room_id: rooms[i % 4].id,
    day_of_week: Math.floor(i / 4) + 1,
    start_time: i % 2 ? '10:00:00' : '08:00:00',
    end_time: i % 2 ? '11:00:00' : '10:00:00',
    active: true,
  }));
  const sessions: Row[] = Array.from({ length: 4 }, (_, i) => ({
    id: id(300 + i),
    teacher_id: teachers[i].id,
    subject_id: subjects[i].id,
    class_id: classes[i].id,
    room_id: rooms[i].id,
    device_id: devices[i].id,
    timetable_id: timetable[i].id,
    start_time: '2026-10-05T07:00:00Z',
    end_time: i === 3 ? '2026-10-05T08:00:00Z' : '2026-10-05T10:00:00Z',
    opened_at: '2026-10-05T07:00:00Z',
    status: i === 3 ? 'closed' : 'open',
    data_version: 1042,
    late_minutes: 10,
  }));
  const session_students: Row[] = students.map((s, i) => ({
    id: id(400 + i),
    student_id: s.id,
    session_id: sessions[Math.floor(i / 12)].id,
    card_uid: s.card_uid,
  }));
  const attendance: Row[] = students.map((s, i) => ({
    id: id(500 + i),
    student_id: s.id,
    session_id: sessions[Math.floor(i / 12)].id,
    device_id: devices[Math.floor(i / 12)].id,
    scanned_at:
      i % 13 === 0
        ? null
        : `2026-10-05T07:${i % 9 === 0 ? '16' : String(i % 10).padStart(2, '0')}:00Z`,
    status: i % 13 === 0 ? 'absent' : i % 9 === 0 ? 'late' : 'present',
    source: 'nfc',
    synced_at: '2026-10-05T07:20:00Z',
  }));
  return withClock({
    students,
    teachers,
    classes,
    subjects,
    rooms,
    devices,
    timetable,
    sessions,
    session_students,
    attendance,
    settings: {
      id: 1,
      school_name: 'Lycée Al Khawarizmi',
      timezone: 'Africa/Casablanca',
      late_minutes: 10,
    },
    version: 1042,
    demo: true,
    role: 'admin',
    userName: 'Administration',
    asOf: '2026-10-05T09:42:00Z',
  });
}
