import 'server-only';
import { requireStaff } from './auth';
import { demoEnabled } from './supabase';
import { demoData } from './demo';
import { entities, type SchoolData, type Row } from './types';
import { withClock } from './clock';
export async function getSchoolData(): Promise<SchoolData> {
  if (demoEnabled()) return demoData();
  const { db, profile } = await requireStaff();
  // Explicit pagination avoids Supabase's default 1,000-row truncation.
  async function rows(table: string): Promise<Row[]> {
    const all: Row[] = [];
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    for (let offset = 0; ; offset += 1000) {
      let q = db
        .from(table)
        .select(
          table === 'attendance' || table === 'session_students'
            ? '*,sessions!inner(start_time)'
            : '*',
        )
        .order(table === 'session_students' ? 'student_id' : 'id');
      if (table === 'session_students') q = q.order('session_id');
      if (table === 'sessions') q = q.gte('start_time', cutoff);
      if (table === 'attendance' || table === 'session_students')
        q = q.gte('sessions.start_time', cutoff);
      const { data, error } = await q.range(offset, offset + 999);
      if (error) throw error;
      all.push(...(data as unknown as Row[]));
      if (data.length < 1000) break;
      if (offset >= 49000) throw new Error('DATA_LIMIT_REACHED');
    }
    return all;
  }
  const tables = [...entities, 'sessions', 'attendance', 'session_students'];
  const [sets, settings, version] = await Promise.all([
    Promise.all(tables.map(rows)),
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('sync_versions').select('version').eq('id', 1).single(),
  ]);
  if (settings.error) throw settings.error;
  if (version.error) throw version.error;
  return withClock({
    ...Object.fromEntries(tables.map((t, i) => [t, sets[i]])),
    settings: settings.data,
    version: Number(version.data.version),
    demo: false,
    role: profile.role,
    userName: profile.full_name,
    asOf: new Date().toISOString(),
  } as Omit<SchoolData, 'clock'>);
}
