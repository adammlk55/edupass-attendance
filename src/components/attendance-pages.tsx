'use client';
import { useState } from 'react';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
} from 'lucide-react';
import { useSchool } from './school-provider';
import { Badge, Avatar, Empty, csvDownload } from './ui';
import { name, lookup } from '@/lib/types';
import { schoolTime } from '@/lib/types';
export function AttendancePage({
  absences = false,
  sessionsView = false,
}: {
  absences?: boolean;
  sessionsView?: boolean;
}) {
  const { data, mutate, setNotice } = useSchool();
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const source = sessionsView ? data.sessions : data.attendance;
  const filtered = source
    .filter((r) => {
      const s = sessionsView ? r : data.sessions.find((s) => s.id === r.session_id);
      const student = data.students.find((st) => st.id === r.student_id);
      return (
        (!absences || ['absent', 'excused'].includes(String(r.status))) &&
        (!query ||
          (sessionsView ? lookup(data, 'teachers', s?.teacher_id) : name(student))
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!date || (s && schoolTime(data, s.start_time, 'date') === date)) &&
        (!classId || s?.class_id === classId) &&
        (!subject || s?.subject_id === subject) &&
        (!status || r.status === status)
      );
    })
    .sort((a, b) =>
      String(b.scanned_at ?? b.start_time ?? '').localeCompare(
        String(a.scanned_at ?? a.start_time ?? ''),
      ),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(currentPage * 12, currentPage * 12 + 12);
  async function action(path: string, payload?: unknown) {
    setBusy(path);
    setError('');
    try {
      const r = await mutate(path, payload);
      setNotice(
        path.includes('finalize')
          ? `${r.count ?? ''} session(s) terminée(s).`
          : 'Justification mise à jour.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  const title = sessionsView ? 'Sessions' : absences ? 'Absences' : 'Présences';
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SUIVI & ACTIVITÉ</span>
          <h1>
            {title}
            <span className="count-pill">{filtered.length}</span>
          </h1>
          <p>
            {sessionsView
              ? 'Retrouvez les cours ouverts par les professeurs.'
              : absences
                ? 'Identifiez les absences et suivez leurs justifications.'
                : 'Chaque pointage, une présence qui compte.'}{' '}
            Historique des 30 derniers jours.
          </p>
        </div>
        <div className="heading-actions">
          {sessionsView && data.role === 'admin' && (
            <button
              className="button"
              disabled={!!busy}
              onClick={() => action('sessions/finalize')}
            >
              <ClipboardCheck size={16} />
              Clôturer les cours terminés
            </button>
          )}
          <button
            className="button"
            disabled={!filtered.length}
            onClick={() =>
              csvDownload(
                `${title.toLowerCase()}.csv`,
                filtered.map((r) => {
                  const s = sessionsView ? r : data.sessions.find((s) => s.id === r.session_id);
                  return {
                    Nom: sessionsView
                      ? lookup(data, 'teachers', r.teacher_id)
                      : lookup(data, 'students', r.student_id),
                    Classe: lookup(data, 'classes', s?.class_id),
                    Matière: lookup(data, 'subjects', s?.subject_id),
                    Date: s?.start_time,
                    Pointage: r.scanned_at,
                    Statut: r.status,
                  };
                }),
              )
            }
          >
            <Download size={16} />
            Exporter
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="filter-bar wrap">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Rechercher"
              placeholder={sessionsView ? 'Rechercher un professeur…' : 'Rechercher un élève…'}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="filter-selects wrap">
            <input
              aria-label="Filtrer par date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(0);
              }}
            />
            <select
              aria-label="Filtrer par classe"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Toutes les classes</option>
              {data.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par matière"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Toutes les matières</option>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par statut"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tous les statuts</option>
              {(sessionsView
                ? [
                    ['open', 'En cours'],
                    ['closed', 'Terminée'],
                    ['cancelled', 'Annulée'],
                  ]
                : absences
                  ? [
                      ['absent', 'Non justifiée'],
                      ['excused', 'Justifiée'],
                    ]
                  : [
                      ['present', 'Présent'],
                      ['late', 'En retard'],
                      ['absent', 'Absent'],
                      ['excused', 'Justifiée'],
                    ]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{sessionsView ? 'Professeur' : 'Élève'}</th>
                <th>Classe / matière</th>
                <th>Date</th>
                <th>{sessionsView ? 'Horaire' : 'Heure / source'}</th>
                {absences && <th>Professeur</th>}
                <th>Statut</th>
                {absences && data.role === 'admin' && <th>Justification</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const s = sessionsView ? r : data.sessions.find((s) => s.id === r.session_id);
                const person = (sessionsView ? data.teachers : data.students).find(
                  (p) => p.id === (sessionsView ? r.teacher_id : r.student_id),
                );
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="person">
                        <Avatar
                          first={String(person?.first_name ?? '')}
                          last={String(person?.last_name ?? '')}
                          color={i}
                        />
                        <span>
                          <strong>{name(person)}</strong>
                          <small>
                            {sessionsView ? lookup(data, 'rooms', r.room_id) : person?.massar_code}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="class-label">{lookup(data, 'classes', s?.class_id)}</span>
                      <small className="cell-sub">{lookup(data, 'subjects', s?.subject_id)}</small>
                    </td>
                    <td>{s ? schoolTime(data, s.start_time, 'shortDate') : '—'}</td>
                    <td className="mono">
                      {sessionsView
                        ? `${schoolTime(data, r.start_time)} – ${schoolTime(data, r.end_time)}`
                        : schoolTime(data, r.scanned_at)}
                      {!sessionsView && (
                        <small className="cell-sub">
                          {r.source === 'manual_admin'
                            ? 'Administration'
                            : r.source === 'mobile_ble'
                              ? 'Bluetooth'
                              : 'Carte NFC'}
                        </small>
                      )}
                    </td>
                    {absences && <td>{lookup(data, 'teachers', s?.teacher_id)}</td>}
                    <td>
                      <Badge status={String(r.status)} />
                    </td>
                    {absences && data.role === 'admin' && (
                      <td>
                        <button
                          className="button small"
                          disabled={!!busy}
                          onClick={() =>
                            action(`attendance/${r.id}`, {
                              status: r.status === 'excused' ? 'absent' : 'excused',
                            })
                          }
                        >
                          <CheckCircle2 size={14} />
                          {r.status === 'excused' ? 'Retirer' : 'Justifier'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title={absences ? 'Aucune absence à afficher' : 'Aucun résultat'}
              description="Les données apparaîtront après les premiers cours et pointages."
            />
          )}
        </div>
        <div className="pagination">
          <span>{filtered.length} résultats</span>
          <div>
            <button
              className="icon-button"
              disabled={!currentPage}
              aria-label="Page précédente"
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {currentPage + 1} / {pages}
            </span>
            <button
              className="icon-button"
              disabled={currentPage === pages - 1}
              aria-label="Page suivante"
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
