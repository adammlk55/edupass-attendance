export type Row = { id: string; [key: string]: string | number | boolean | null };
export const entities = [
  'students',
  'teachers',
  'classes',
  'subjects',
  'rooms',
  'devices',
  'timetable',
] as const;
export type Entity = (typeof entities)[number];
export type SchoolData = {
  students: Row[];
  teachers: Row[];
  classes: Row[];
  subjects: Row[];
  rooms: Row[];
  devices: Row[];
  timetable: Row[];
  sessions: Row[];
  attendance: Row[];
  session_students: Row[];
  settings: { id: number; school_name: string; timezone: string; late_minutes: number };
  version: number;
  demo: boolean;
  role: 'admin' | 'staff';
  userName: string;
  asOf: string;
  clock: Record<string, { date: string; time: string; shortDate: string; dateTime: string }>;
};
export const labels: Record<string, string> = {
  students: 'Élèves',
  teachers: 'Professeurs',
  classes: 'Classes',
  subjects: 'Matières',
  rooms: 'Salles',
  devices: 'Appareils',
  timetable: 'Emploi du temps',
  attendance: 'Présences',
  absences: 'Absences',
  sessions: 'Sessions',
  sync: 'Synchronisation',
  settings: 'Paramètres',
  dashboard: 'Tableau de bord',
};
export function name(row?: Row) {
  return row ? String(row.name || `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()) : '—';
}
export function lookup(data: SchoolData, entity: Entity, id: unknown) {
  return name(data[entity].find((r) => r.id === id));
}
export const weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export function localDate(timestamp: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}
export function time(timestamp: unknown, timezone = 'Africa/Casablanca') {
  return timestamp
    ? new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }).format(new Date(String(timestamp)))
    : '—';
}
export function online(row: Row, now = Date.now()) {
  return Boolean(
    row.active && row.last_seen_at && now - new Date(String(row.last_seen_at)).getTime() < 300_000,
  );
}
// Render the same school timezone on server and browser, even when their IANA data differs.
export function schoolTime(
  data: SchoolData,
  value: unknown,
  kind: 'date' | 'time' | 'shortDate' | 'dateTime' = 'time',
) {
  return value ? (data.clock[String(value)]?.[kind] ?? '—') : '—';
}
