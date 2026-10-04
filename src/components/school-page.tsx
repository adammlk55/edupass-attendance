'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Save, ShieldCheck, Server, Users, ClipboardCheck } from 'lucide-react';
import { Dashboard } from './dashboard';
import { EntityList } from './entity-list';
import { Timetable } from './timetable';
import { Devices } from './device-pages';
import { AttendancePage } from './attendance-pages';
import { useSchool } from './school-provider';
import { Avatar, Badge, Empty } from './ui';
import { type Entity, name } from '@/lib/types';
import { entitySchemas } from '@/lib/validation';
export function SchoolPage({ section, detailId }: { section: string; detailId?: string }) {
  if (section === 'dashboard') return <Dashboard />;
  if (section === 'devices' || section === 'sync')
    return <Devices detailId={detailId} sync={section === 'sync'} />;
  if (section === 'timetable') return <Timetable />;
  if (section === 'attendance' || section === 'absences' || section === 'sessions')
    return (
      <AttendancePage absences={section === 'absences'} sessionsView={section === 'sessions'} />
    );
  if (section === 'settings') return <SettingsPage />;
  if (section === 'classes' && detailId) return <ClassDetail id={detailId} />;
  return <EntityList entity={section as Entity} />;
}
function ClassDetail({ id }: { id: string }) {
  const { data } = useSchool();
  const c = data.classes.find((c) => c.id === id);
  const students = data.students.filter((s) => s.class_id === id);
  const [tab, setTab] = useState('students');
  const sessions = new Set(data.sessions.filter((s) => s.class_id === id).map((s) => s.id));
  const total = data.session_students.filter((s) => sessions.has(String(s.session_id))).length;
  const present = data.attendance.filter(
    (a) => sessions.has(String(a.session_id)) && ['present', 'late'].includes(String(a.status)),
  ).length;
  if (!c) return <Empty title="Classe introuvable" />;
  return (
    <div className="page">
      <Link href="/classes" className="back-link">
        <ArrowLeft size={15} />
        Toutes les classes
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FICHE CLASSE</span>
          <h1>{c.name}</h1>
          <p>Année scolaire {c.academic_year}</p>
        </div>
        <Badge status={c.active ? 'active' : 'inactive'} />
      </div>
      <div className="stats-grid two">
        <div className="stat-card">
          <div className="stat-top">
            Effectif
            <Users size={18} />
          </div>
          <strong className="stat-number">{students.filter((s) => s.active).length}</strong>
          <p>élèves actifs dans la classe</p>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            Présence sur 30 jours
            <ClipboardCheck size={18} />
          </div>
          <strong className="stat-number">
            {total ? `${Math.round((present / total) * 100)} %` : '—'}
          </strong>
          <p>
            {present} présences / {total} attendues
          </p>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'students' ? 'selected' : ''} onClick={() => setTab('students')}>
          Élèves
        </button>
        <button
          className={tab === 'timetable' ? 'selected' : ''}
          onClick={() => setTab('timetable')}
        >
          Emploi du temps
        </button>
      </div>
      {tab === 'timetable' ? (
        <Timetable classId={id} embedded />
      ) : (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Élève</th>
                <th>Massar</th>
                <th>Carte NFC</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <div className="person">
                      <Avatar first={String(s.first_name)} last={String(s.last_name)} color={i} />
                      <strong>{name(s)}</strong>
                    </div>
                  </td>
                  <td className="mono">{s.massar_code}</td>
                  <td className="mono">{s.card_uid ?? 'Non attribuée'}</td>
                  <td>
                    <Badge status={s.active ? 'active' : 'inactive'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.length && <Empty />}
        </section>
      )}
    </div>
  );
}
function SettingsPage() {
  const { data, mutate, setNotice } = useSchool();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">VOTRE ESPACE</span>
          <h1>Paramètres</h1>
          <p>Les réglages essentiels de votre établissement.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Établissement & présences</h2>
          </div>
          <form
            className="settings-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const f = new FormData(e.currentTarget);
              try {
                const p = entitySchemas.settings.parse({
                  school_name: f.get('school_name'),
                  timezone: f.get('timezone'),
                  late_minutes: Number(f.get('late_minutes')),
                });
                await mutate('settings', p);
                setNotice(
                  'Paramètres enregistrés. Les nouvelles sessions utiliseront ces réglages.',
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Échec de la sauvegarde.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nom de l’établissement
              <input name="school_name" required defaultValue={data.settings.school_name} />
            </label>
            <label>
              Fuseau horaire
              <select name="timezone" defaultValue={data.settings.timezone}>
                {Array.from(
                  new Set([
                    data.settings.timezone,
                    'Africa/Casablanca',
                    'Africa/Sao_Tome',
                    'Europe/Paris',
                    'UTC',
                  ]),
                ).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Seuil de retard (minutes)
              <input
                name="late_minutes"
                type="number"
                min="0"
                max="60"
                required
                defaultValue={data.settings.late_minutes}
              />
            </label>
            <p className="form-help">
              Un pointage dans les {data.settings.late_minutes} premières minutes du cours est
              considéré comme présent. Les règles existantes restent conservées pour les sessions
              déjà ouvertes.
            </p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {data.role === 'admin' && (
              <button className="button primary" disabled={busy}>
                <Save size={16} />
                {busy ? 'Enregistrement…' : 'Enregistrer les paramètres'}
              </button>
            )}
          </form>
        </section>
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>
                <Server size={18} />
                Connexion Supabase
              </h2>
              <Badge status={data.demo ? 'pending' : 'online'} />
            </div>
            <div className="detail-body">
              {data.demo ? (
                <>
                  <h3>Prêt à accueillir votre école</h3>
                  <p>
                    Cette démonstration utilise des données fictives. Pour enregistrer vos données
                    et connecter les ESP32 :
                  </p>
                  <ol className="setup-steps">
                    <li>Créez votre nouveau projet Supabase.</li>
                    <li>
                      Appliquez la migration SQL du dossier <code>supabase/migrations</code>.
                    </li>
                    <li>
                      Ajoutez vos clés dans <code>.env.local</code>.
                    </li>
                    <li>Créez votre compte et son profil administrateur.</li>
                    <li>Redémarrez l’application sans le mode démonstration.</li>
                  </ol>
                  <p className="form-help">
                    Les commandes et explications se trouvent dans le README du projet.
                  </p>
                </>
              ) : (
                <p>
                  Votre établissement est connecté. Les données sont enregistrées dans votre projet
                  Supabase.
                </p>
              )}
            </div>
          </section>
          <section className="panel security-note">
            <ShieldCheck size={23} />
            <div>
              <h3>Des accès maîtrisés</h3>
              <p>
                Les administrateurs gèrent les données et les appareils. L’équipe pédagogique
                dispose d’un accès en lecture. La création des comptes est réservée au responsable
                du projet Supabase.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
