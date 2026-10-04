'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  ContactRound,
  School,
  BookOpen,
  CalendarDays,
  DoorOpen,
  Radio,
  ClipboardCheck,
  UserRoundX,
  Layers,
  RefreshCw,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useSchool } from './school-provider';
import { labels } from '@/lib/types';
const groups = [
  { label: 'VUE D’ENSEMBLE', items: [['dashboard', 'Tableau de bord', LayoutDashboard]] },
  {
    label: 'ÉTABLISSEMENT',
    items: [
      ['students', 'Élèves', Users],
      ['teachers', 'Professeurs', ContactRound],
      ['classes', 'Classes', School],
      ['subjects', 'Matières', BookOpen],
      ['timetable', 'Emploi du temps', CalendarDays],
      ['rooms', 'Salles', DoorOpen],
    ],
  },
  {
    label: 'SUIVI & ACTIVITÉ',
    items: [
      ['attendance', 'Présences', ClipboardCheck],
      ['absences', 'Absences', UserRoundX],
      ['sessions', 'Sessions', Layers],
      ['devices', 'Appareils', Radio],
      ['sync', 'Synchronisation', RefreshCw],
    ],
  },
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const { data, notice, syncError, setNotice } = useSchool();
  const pathname = usePathname();
  const active = pathname.split('/')[1] || 'dashboard';
  const [opened, setOpened] = useState(false);
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>
      {opened && (
        <button
          className="sidebar-scrim"
          aria-label="Fermer le menu"
          onClick={() => setOpened(false)}
        />
      )}
      <aside className={`sidebar ${opened ? 'expanded' : ''}`}>
        <Link href="/" className="brand">
          <span className="brand-mark">
            <GraduationCap size={24} />
          </span>
          EduPass<span className="brand-dot">.</span>
        </Link>
        <Link
          href="/settings"
          className="school-switch"
          onClick={() => setOpened(false)}
        >
          <span className="school-icon">
            <School size={19} />
          </span>
          <span>
            <strong>{data.settings.school_name}</strong>
            <small>
              Année scolaire {String(data.classes.find((c) => c.active)?.academic_year ?? '—')}
            </small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <nav aria-label="Navigation principale">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([key, label, Icon]) => (
                <Link
                  href={key === 'dashboard' ? '/' : `/${key}`}
                  key={key}
                  onClick={() => setOpened(false)}
                  className={`nav-item ${active === key ? 'active' : ''}`}
                  aria-current={active === key ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {key === 'devices' && <span className="nav-count">{data.devices.length}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card">
            <span>
              <ShieldCheck size={18} /> Pensé pour votre école
            </span>
            <p>
              Les présences continuent,
              <br />
              même sans connexion.
            </p>
            <Link href="/sync">
              Voir la synchronisation <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link href="/settings" className={`nav-item ${active === 'settings' ? 'active' : ''}`}>
            <Settings size={18} />
            Paramètres
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Ouvrir le menu"
              onClick={() => setOpened(true)}
            >
              <Menu size={22} />
            </button>
            <School size={16} />
            <span>Espace administration</span>
            <span className="slash">/</span>
            <strong>{labels[active] ?? 'Vue d’ensemble'}</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${syncError ? 'warn' : ''}`}>
              <i />
              {data.demo ? 'Démonstration' : 'Connecté'}
            </span>
            <span className="top-divider" />
            <span className="avatar admin">AD</span>
            <div className="user-label">
              <strong>{data.userName}</strong>
              <small>{data.role === 'admin' ? 'Administrateur' : 'Équipe pédagogique'}</small>
            </div>
            {!data.demo && (
              <button
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="icon-button"
                onClick={async () => {
                  const res = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'logout' }),
                  });
                  if (res.ok) window.location.assign('/login');
                  else setNotice('Déconnexion impossible. Réessayez.');
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </header>
        {data.demo && (
          <div className="demo-banner">
            <span>
              <strong>Mode démonstration</strong> · Données fictives. Les modifications durent le
              temps de cette visite.
            </span>
            <Link href="/settings">
              Configurer EduPass <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        {syncError && (
          <div className="sync-error" role="alert">
            {syncError}
          </div>
        )}
        <main id="main">{children}</main>
        <footer className="footer">
          <span>EduPass · Chaque présence compte.</span>
          <span>
            {data.demo ? 'Aperçu interactif' : 'Actualisation automatique toutes les 5 s'}
            <i />
          </span>
        </footer>
      </div>
      {notice && (
        <div role="status" className="toast">
          {notice}
          <button aria-label="Fermer la notification" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
