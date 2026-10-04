'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Users,
  ClipboardCheck,
  UserRoundX,
  Radio,
  ArrowUpRight,
  ArrowRight,
  Download,
  CalendarDays,
  Clock3,
  BookOpen,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';
import { useSchool } from './school-provider';
import { Badge, Avatar, Empty, csvDownload } from './ui';
import { lookup, name, online } from '@/lib/types';
import { schoolTime } from '@/lib/types';
export function Dashboard() {
  const { data } = useSchool();
  const [date, setDate] = useState(schoolTime(data, data.asOf, 'date'));
  const sessions = data.sessions.filter((s) => schoolTime(data, s.start_time, 'date') === date);
  const ids = new Set(sessions.map((s) => s.id));
  const records = data.attendance.filter((a) => ids.has(String(a.session_id)));
  const roster = data.session_students.filter((r) => ids.has(String(r.session_id)));
  const present = records.filter((r) => ['present', 'late'].includes(String(r.status))).length;
  const absent = new Set(records.filter((r) => r.status === 'absent').map((r) => r.student_id))
    .size;
  const late = records.filter((r) => r.status === 'late').length;
  const pending = Math.max(0, roster.length - records.length);
  const rate = roster.length ? Math.round((present / roster.length) * 100) : 0;
  const activeDevices = data.devices.filter((d) => d.active);
  const onlineCount = activeDevices.filter((d) => online(d, new Date(data.asOf).getTime())).length;
  const needSync = activeDevices.filter(
    (d) => Number(d.local_data_version) < data.version || d.force_sync_id,
  );
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const lessons = data.timetable
    .filter((t) => t.active && t.day_of_week === day)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
  const recent = records
    .filter((r) => r.scanned_at)
    .sort((a, b) => String(b.scanned_at).localeCompare(String(a.scanned_at)))
    .slice(0, 5);
  const stats = [
    {
      label: 'Élèves inscrits',
      value: data.students.filter((s) => s.active).length,
      sub: `Répartis dans ${data.classes.filter((c) => c.active).length} classes`,
      Icon: Users,
      color: 'purple',
      foot: 'Effectif actif',
    },
    {
      label: 'Taux de présence',
      value: roster.length ? `${rate} %` : '—',
      sub: `${present} présences sur ${roster.length} attendues`,
      Icon: ClipboardCheck,
      color: 'green',
      foot: roster.length ? 'Suivi des sessions du jour' : 'Aucune session ce jour',
    },
    {
      label: 'Élèves absents',
      value: absent,
      sub: `${late} retard${late > 1 ? 's' : ''} enregistré${late > 1 ? 's' : ''}`,
      Icon: UserRoundX,
      color: 'orange',
      foot: 'Absences confirmées',
    },
    {
      label: 'Appareils connectés',
      value: `${onlineCount} / ${activeDevices.length}`,
      sub: `${activeDevices.length - onlineCount} appareil(s) hors ligne`,
      Icon: Radio,
      color: 'blue',
      foot: 'Dernier contact < 5 min',
    },
  ];
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">VOTRE ÉTABLISSEMENT EN UN COUP D’ŒIL</div>
          <h1>
            Tableau de bord <span className="heading-dot" />
          </h1>
          <p>Une nouvelle journée pour accompagner chaque élève.</p>
        </div>
        <div className="heading-actions">
          <label className="date-control">
            <CalendarDays size={16} />
            <input
              aria-label="Date du tableau de bord"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={!records.length}
            onClick={() =>
              csvDownload(
                `edupass-${date}.csv`,
                records.map((r) => ({
                  Élève: name(data.students.find((s) => s.id === r.student_id)),
                  Classe: lookup(
                    data,
                    'classes',
                    sessions.find((s) => s.id === r.session_id)?.class_id,
                  ),
                  Statut: r.status,
                  Heure: schoolTime(data, r.scanned_at),
                })),
              )
            }
          >
            <Download size={16} />
            Exporter
          </button>
        </div>
      </div>
      <div className="welcome-strip">
        <div className="welcome-symbol">
          <GraduationScene />
        </div>
        <div>
          <h2>Bienvenue dans votre espace de suivi</h2>
          <p>
            <strong>{sessions.filter((s) => s.status === 'open').length} sessions en cours</strong>
            <span>·</span>
            {data.teachers.filter((t) => t.active).length} professeurs<span>·</span>
            {lessons.length} cours prévus aujourd’hui
          </p>
        </div>
        <Link href="/timetable" className="text-link">
          Voir l’emploi du temps <ArrowRight size={16} />
        </Link>
      </div>
      <div className="stats-grid">
        {stats.map(({ label, value, sub, Icon, color, foot }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="stat-number">{value}</strong>
            <p>{sub}</p>
            <div className="stat-foot">
              <span className={`tiny-dot ${color}`} />
              {foot}
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-row">
        <section className="panel attendance-chart">
          <div className="panel-heading">
            <div>
              <h2>Présence par classe</h2>
              <p>La participation aux sessions du jour</p>
            </div>
            <span className="legend">
              <i /> Présents & retards
            </span>
          </div>
          <div className="bar-chart">
            <div className="chart-grid">
              <span>100 %</span>
              <span>75 %</span>
              <span>50 %</span>
              <span>25 %</span>
              <span>0 %</span>
            </div>
            <div className="bars">
              {data.classes
                .filter((c) => c.active)
                .slice(0, 8)
                .map((c, i) => {
                  const ss = new Set(sessions.filter((s) => s.class_id === c.id).map((s) => s.id));
                  const total = roster.filter((r) => ss.has(String(r.session_id))).length;
                  const attended = records.filter(
                    (r) =>
                      ss.has(String(r.session_id)) &&
                      ['present', 'late'].includes(String(r.status)),
                  ).length;
                  const pct = total ? Math.round((attended / total) * 100) : 0;
                  return (
                    <div className="bar-group" key={c.id}>
                      <div className="bar-track">
                        <div
                          className={`bar bar-${i % 4}`}
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        >
                          <span>{total ? `${pct} %` : '—'}</span>
                        </div>
                      </div>
                      <span>{c.name}</span>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="chart-caption">
            <span>
              <span className="tiny-dot purple" /> Sur la base des élèves attendus par session
            </span>
            <Link href="/attendance">
              Détail des présences <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        <section className="panel distribution">
          <div className="panel-heading">
            <div>
              <h2>Le point sur la journée</h2>
              <p>
                {new Intl.DateTimeFormat('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${date}T12:00:00`))}
              </p>
            </div>
          </div>
          <div
            className="donut"
            style={{ background: `conic-gradient(#7360dd 0 ${rate}%, #eef0f6 ${rate}% 100%)` }}
          >
            <div>
              <strong>{roster.length ? `${rate}%` : '—'}</strong>
              <span>de présence</span>
            </div>
          </div>
          <div className="distribution-legend">
            <span>
              <i className="purple-bg" />
              Présents<strong>{present - late}</strong>
            </span>
            <span>
              <i className="orange-bg" />
              En retard<strong>{late}</strong>
            </span>
            <span>
              <i className="red-bg" />
              Absences<strong>{records.filter((r) => r.status === 'absent').length}</strong>
            </span>
            <span>
              <i className="gray-bg" />À pointer / justifiés
              <strong>{pending + records.filter((r) => r.status === 'excused').length}</strong>
            </span>
          </div>
        </section>
      </div>
      <div className="dashboard-row lower">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Derniers pointages{' '}
                <span className="live-tag">
                  <i /> {data.demo ? 'Aperçu' : 'En direct'}
                </span>
              </h2>
              <p>Les dernières arrivées dans vos salles</p>
            </div>
            <Link href="/attendance" className="text-link">
              Tout voir <ArrowRight size={15} />
            </Link>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Heure</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => {
                  const student = data.students.find((s) => s.id === r.student_id);
                  const session = sessions.find((s) => s.id === r.session_id);
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="person">
                          <Avatar
                            first={String(student?.first_name ?? '')}
                            last={String(student?.last_name ?? '')}
                            color={i}
                          />
                          <span>
                            <strong>{name(student)}</strong>
                            <small>{student?.massar_code}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="class-label">
                          {lookup(data, 'classes', session?.class_id)}
                        </span>
                      </td>
                      <td className="mono">{schoolTime(data, r.scanned_at)}</td>
                      <td>
                        <Badge status={String(r.status)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!recent.length && (
              <Empty
                title="Aucun pointage pour cette journée"
                description="Les nouvelles présences apparaîtront ici après leur envoi par les bornes."
              />
            )}
          </div>
        </section>
        <section className="panel lessons-panel">
          <div className="panel-heading">
            <div>
              <h2>Cours du jour</h2>
              <p>{lessons.length} cours à l’emploi du temps</p>
            </div>
            <Link href="/timetable" aria-label="Voir tous les cours" className="icon-button">
              <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className="lesson-list">
            {lessons.slice(0, 3).map((l, i) => (
              <div className="lesson" key={l.id}>
                <span className={`lesson-icon color-${i}`}>
                  <BookOpen size={18} />
                </span>
                <div>
                  <h3>{lookup(data, 'subjects', l.subject_id)}</h3>
                  <p>
                    {lookup(data, 'classes', l.class_id)} · {lookup(data, 'rooms', l.room_id)}
                  </p>
                  <small>
                    <Clock3 size={12} />
                    {String(l.start_time).slice(0, 5)} – {String(l.end_time).slice(0, 5)}
                    <span>· {lookup(data, 'teachers', l.teacher_id)}</span>
                  </small>
                </div>
              </div>
            ))}
            {!lessons.length && (
              <Empty
                title="Pas de cours prévu"
                description="Profitez d’une journée sans cours planifié."
              />
            )}
          </div>
          <Link className="panel-bottom-link" href="/timetable">
            Consulter l’emploi du temps <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <section className="sync-summary">
        <span className={`sync-summary-icon ${needSync.length ? 'amber' : ''}`}>
          {needSync.length ? <WifiOff size={22} /> : <CheckCircle2 size={22} />}
        </span>
        <div>
          <h3>
            {needSync.length
              ? `${needSync.length} appareils à synchroniser`
              : 'Vos appareils sont à jour'}
          </h3>
          <p>
            Version serveur <strong>v{data.version}</strong> · Synchronisation complète les lundis
            et jeudis
          </p>
        </div>
        <Link href="/sync" className="button">
          Gérer la synchronisation <ArrowRight size={15} />
        </Link>
      </section>
    </div>
  );
}
function GraduationScene() {
  return (
    <svg width="75" height="64" viewBox="0 0 75 64" fill="none" aria-hidden="true">
      <rect x="12" y="22" width="45" height="31" rx="6" fill="#d9d2f7" />
      <path d="M8 23 37 9 67 23 37 36 8 23Z" fill="#7862da" />
      <path d="M21 31v12c10 8 23 8 33 0V31L37 39 21 31Z" fill="#9c89ec" />
      <path d="M66 24v19" stroke="#7862da" strokeWidth="2" />
      <circle cx="66" cy="46" r="3" fill="#f0bb64" />
      <path d="m7 9 2 3 4 1-4 1-2 3-1-3-4-1 4-1 1-3Z" fill="#c3b4ed" />
    </svg>
  );
}
