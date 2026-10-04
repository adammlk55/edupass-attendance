'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { SchoolData, Row } from '@/lib/types';
import { withClock } from '@/lib/clock';
const messages: Record<string, string> = {
  TIMETABLE_CONFLICT: 'Ce professeur, cette classe ou cette salle a déjà un cours sur ce créneau.',
  DUPLICATE_VALUE: 'Ce code, cette carte ou cette salle est déjà utilisé.',
  REFERENCE_IN_USE: 'Cet élément est encore utilisé.',
  INACTIVE_REFERENCE: 'Veuillez sélectionner des éléments actifs.',
  FORBIDDEN: 'Cette action est réservée aux administrateurs.',
  VALIDATION_ERROR: 'Vérifiez les informations du formulaire.',
  INVALID_VALUE: 'Une valeur est incorrecte.',
  UNAUTHENTICATED: 'Votre session a expiré. Reconnectez-vous.',
  NOT_CONFIGURED: 'Supabase n’est pas encore configuré.',
};
type Context = {
  data: SchoolData;
  refresh: () => Promise<void>;
  mutate: (path: string, payload?: unknown) => Promise<Record<string, unknown>>;
  notice: string;
  setNotice: (v: string) => void;
  syncError: string;
};
const SchoolContext = createContext<Context | null>(null);
export function SchoolProvider({
  initial,
  children,
}: {
  initial: SchoolData;
  children: ReactNode;
}) {
  const [data, setData] = useState(initial);
  const [notice, setNotice] = useState('');
  const [syncError, setSyncError] = useState('');
  const refresh = useCallback(async () => {
    if (initial.demo) return;
    try {
      const res = await fetch('/api/admin/data', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (!res.ok) throw new Error();
      setData(await res.json());
      setSyncError('');
    } catch {
      setSyncError('Actualisation interrompue. Les dernières données reçues restent affichées.');
    }
  }, [initial.demo]);
  useEffect(() => {
    if (initial.demo) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [initial.demo, refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function mutate(path: string, payload?: unknown): Promise<Record<string, unknown>> {
    if (data.demo) {
      const [entity, id, action] = path.split('/');
      if (action === 'key')
        throw new Error('Les clés réelles seront disponibles après la connexion à Supabase.');
      if (entity === 'settings') {
        setData((d) =>
          withClock({
            ...d,
            settings: { ...d.settings, ...(payload as object) },
            version: d.version + 1,
          }),
        );
        return { ok: true };
      }
      if (entity === 'sessions' && id === 'finalize') {
        setData((d) => ({
          ...d,
          sessions: d.sessions.map((s) =>
            new Date(String(s.end_time)).getTime() <= new Date(d.asOf).getTime()
              ? { ...s, status: 'closed' }
              : s,
          ),
        }));
        return { ok: true };
      }
      const rows = data[entity as keyof SchoolData];
      if (!Array.isArray(rows)) throw new Error('Action indisponible.');
      const p = payload as Row;
      if (
        entity === 'timetable' &&
        p.active &&
        rows.some(
          (r) =>
            r.id !== id &&
            r.active &&
            r.day_of_week === p.day_of_week &&
            String(r.start_time) < String(p.end_time) &&
            String(r.end_time) > String(p.start_time) &&
            (r.teacher_id === p.teacher_id || r.room_id === p.room_id || r.class_id === p.class_id),
        )
      )
        throw new Error(messages.TIMETABLE_CONFLICT);
      if (
        p &&
        rows.some(
          (r) =>
            r.id !== id &&
            ['card_uid', 'massar_code', 'teacher_code', 'device_code', 'code'].some(
              (k) => p[k] && r[k] === p[k],
            ),
        )
      )
        throw new Error(messages.DUPLICATE_VALUE);
      const newId = id ?? crypto.randomUUID();
      setData((d) => ({
        ...d,
        version: d.version + (entity === 'attendance' || action === 'sync' ? 0 : 1),
        [entity]: id
          ? rows.map((r) =>
              r.id === id
                ? {
                    ...r,
                    ...p,
                    ...(action === 'sync' ? { force_sync_id: crypto.randomUUID() } : {}),
                  }
                : r,
            )
          : [...rows, { ...p, id: newId }],
      }));
      return { ok: true, id: newId };
    }
    const res = await fetch(`/api/admin/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(messages[result.error] ?? 'L’opération a échoué. Réessayez.');
    await refresh();
    return result;
  }
  return (
    <SchoolContext.Provider value={{ data, refresh, mutate, notice, setNotice, syncError }}>
      {children}
    </SchoolContext.Provider>
  );
}
export function useSchool() {
  const context = useContext(SchoolContext);
  if (!context) throw new Error('Missing SchoolProvider');
  return context;
}
