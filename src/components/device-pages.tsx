'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Radio,
  Plus,
  RefreshCw,
  ArrowUpRight,
  Clock3,
  KeyRound,
  Pencil,
  ArrowLeft,
  CheckCircle2,
  Database,
  UploadCloud,
  Copy,
} from 'lucide-react';
import { useSchool } from './school-provider';
import { Badge, Modal, Empty } from './ui';
import { EntityEditor } from './entity-editor';
import { type Row, online, lookup } from '@/lib/types';
import { schoolTime } from '@/lib/types';
export function Devices({ detailId, sync = false }: { detailId?: string; sync?: boolean }) {
  const { data, mutate, setNotice } = useSchool();
  const [editor, setEditor] = useState<Row | 'new' | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [confirmKey, setConfirmKey] = useState(false);
  const device = data.devices.find((d) => d.id === detailId);
  const now = new Date(data.asOf).getTime();
  async function force(d: Row) {
    setBusy(d.id);
    setError('');
    try {
      await mutate(`devices/${d.id}/sync`);
      setNotice('Demande envoyée. L’appareil la récupérera à sa prochaine connexion.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function generateKey() {
    if (!device) return;
    setBusy('key');
    setError('');
    try {
      const r = await mutate(`devices/${device.id}/key`);
      setKey(String(r.key));
      setConfirmKey(false);
    } catch (e) {
      setError((e as Error).message);
      setConfirmKey(false);
    } finally {
      setBusy('');
    }
  }
  if (detailId && !device)
    return (
      <div className="page">
        <Empty title="Appareil introuvable" />
        <Link href="/devices" className="button">
          Tous les appareils
        </Link>
      </div>
    );
  const rows = device ? [device] : data.devices;
  const currentSessions = data.sessions.filter(
    (s) => s.device_id === device?.id && s.status === 'open',
  );
  return (
    <div className="page">
      {device && (
        <Link className="back-link" href="/devices">
          <ArrowLeft size={15} />
          Tous les appareils
        </Link>
      )}
      <div className="page-heading">
        <div>
          <span className="eyebrow">INFRASTRUCTURE CONNECTÉE</span>
          <h1>
            {device ? device.name : sync ? 'Synchronisation' : 'Appareils'}{' '}
            {device && <Badge status={online(device, now) ? 'online' : 'offline'} />}
          </h1>
          <p>
            {device
              ? `${device.device_code} · ${lookup(data, 'rooms', device.room_id)}`
              : sync
                ? 'Vos données à jour, dans chaque salle, même hors ligne.'
                : 'Supervisez les bornes NFC de votre établissement.'}
          </p>
        </div>
        {data.role === 'admin' && !sync && (
          <button className="button primary" onClick={() => setEditor(device ?? 'new')}>
            {device ? <Pencil size={16} /> : <Plus size={16} />}{' '}
            {device ? 'Modifier' : 'Ajouter un appareil'}
          </button>
        )}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {sync && (
        <>
          <div className="stats-grid sync-stats">
            {[
              { label: 'Version serveur', value: `v${data.version}`, Icon: Database },
              {
                label: 'Appareils à jour',
                value: data.devices.filter(
                  (d) => Number(d.local_data_version) === data.version && !d.force_sync_id,
                ).length,
                Icon: CheckCircle2,
              },
              {
                label: 'À synchroniser',
                value: data.devices.filter(
                  (d) => Number(d.local_data_version) < data.version || d.force_sync_id,
                ).length,
                Icon: RefreshCw,
              },
              {
                label: 'Envois en attente',
                value: data.devices.reduce((sum, d) => sum + Number(d.pending_uploads ?? 0), 0),
                Icon: UploadCloud,
              },
            ].map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-top">
                  {s.label}
                  <s.Icon size={19} />
                </div>
                <strong className="stat-number">{s.value}</strong>
                <p>
                  {s.label === 'Envois en attente'
                    ? 'Dernier nombre déclaré par les bornes'
                    : 'État de la synchronisation'}
                </p>
              </div>
            ))}
          </div>
          <div className="info-banner">
            <RefreshCw size={22} />
            <div>
              <strong>Un fonctionnement autonome, une synchronisation intelligente</strong>
              <p>
                Complète le lundi et le jeudi · Vérification quotidienne et à chaque reconnexion ·
                Confirmation après sauvegarde locale
              </p>
            </div>
          </div>
        </>
      )}
      <div className={`device-grid ${device ? 'single' : ''}`}>
        {rows.map((d, i) => {
          const connected = online(d, now);
          const upToDate = Number(d.local_data_version) === data.version && !d.force_sync_id;
          return (
            <article className="panel device-card" key={d.id}>
              <div className="device-card-top">
                <span className={`device-symbol color-${i % 5}`}>
                  <Radio size={26} />
                </span>
                <Badge status={!d.active ? 'inactive' : connected ? 'online' : 'offline'} />
              </div>
              <Link href={`/devices/${d.id}`}>
                <h2>
                  {d.name}
                  <ArrowUpRight size={17} />
                </h2>
              </Link>
              <p className="device-room">
                {lookup(data, 'rooms', d.room_id)}
                <span className="mono">{d.device_code}</span>
              </p>
              <dl>
                <div>
                  <dt>Dernier contact</dt>
                  <dd>{schoolTime(data, d.last_seen_at, 'dateTime')}</dd>
                </div>
                <div>
                  <dt>Dernière synchronisation</dt>
                  <dd>{schoolTime(data, d.last_sync_at, 'dateTime')}</dd>
                </div>
                <div>
                  <dt>Version locale / serveur</dt>
                  <dd>
                    <span className={!upToDate ? 'text-amber' : ''}>
                      v{d.local_data_version ?? 0}
                    </span>{' '}
                    / v{data.version}
                  </dd>
                </div>
                <div>
                  <dt>Firmware</dt>
                  <dd className="mono">{d.firmware_version ?? 'Non renseigné'}</dd>
                </div>
              </dl>
              <div className={`device-sync-line ${upToDate ? 'good' : 'needs-sync'}`}>
                {upToDate ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}{' '}
                {d.force_sync_id
                  ? 'Synchronisation demandée'
                  : upToDate
                    ? 'Toutes les données sont à jour'
                    : 'Mise à jour des données nécessaire'}
              </div>
              {data.role === 'admin' && (
                <button
                  className="button full-width"
                  disabled={busy === d.id || !!d.force_sync_id}
                  onClick={() => force(d)}
                >
                  <RefreshCw size={15} />
                  {busy === d.id
                    ? 'Envoi…'
                    : d.force_sync_id
                      ? 'En attente de connexion'
                      : 'Forcer la synchronisation'}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <Empty
          title="Aucun appareil installé"
          description="Ajoutez une borne et associez-la à une salle pour commencer."
        />
      )}
      {device && (
        <div className="detail-columns">
          <section className="panel">
            <div className="panel-heading">
              <h2>Activité de la salle</h2>
            </div>
            <div className="detail-body">
              <h3>Sessions en cours</h3>
              {currentSessions.length ? (
                currentSessions.map((s) => (
                  <div className="detail-session" key={s.id}>
                    <Badge status="open" />
                    <strong>{lookup(data, 'subjects', s.subject_id)}</strong>
                    <p>
                      {lookup(data, 'teachers', s.teacher_id)} ·{' '}
                      {lookup(data, 'classes', s.class_id)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="muted">Aucune session ouverte.</p>
              )}
              <h3>Derniers pointages</h3>
              {data.attendance
                .filter((a) => a.device_id === device.id && a.scanned_at)
                .sort((a, b) => String(b.scanned_at).localeCompare(String(a.scanned_at)))
                .slice(0, 6)
                .map((a) => (
                  <div className="simple-row" key={a.id}>
                    <span>{lookup(data, 'students', a.student_id)}</span>
                    <span>{schoolTime(data, a.scanned_at)}</span>
                    <Badge status={String(a.status)} />
                  </div>
                ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Authentification de la borne</h2>
              <KeyRound size={18} />
            </div>
            <div className="detail-body">
              <p>
                Chaque appareil possède une clé privée. Elle est affichée une seule fois lors de sa
                génération, puis stockée sous forme d’empreinte.
              </p>
              <div className="code-box">X-Device-Key: votre-clé</div>
              <p className="muted">
                La génération d’une nouvelle clé révoque immédiatement la précédente.
              </p>
              {data.role === 'admin' && (
                <button className="button" onClick={() => setConfirmKey(true)}>
                  <KeyRound size={15} />
                  Générer une nouvelle clé
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {confirmKey && (
        <Modal title="Générer la clé de l’appareil" onClose={() => setConfirmKey(false)}>
          <p>
            L’ancienne clé de {device?.name} cessera de fonctionner. Vous devrez configurer la
            nouvelle clé sur cette borne.
          </p>
          <div className="modal-footer">
            <button className="button" onClick={() => setConfirmKey(false)}>
              Annuler
            </button>
            <button className="button primary" disabled={busy === 'key'} onClick={generateKey}>
              Générer la clé
            </button>
          </div>
        </Modal>
      )}
      {key && (
        <Modal title="Clé générée · à conserver maintenant" onClose={() => setKey('')}>
          <p>
            Copiez cette clé dans la configuration privée de votre ESP32. Elle ne sera plus
            affichée.
          </p>
          <code className="secret-key">{key}</code>
          <button
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(key);
                setNotice('Clé copiée.');
              } catch {
                setNotice('Sélectionnez et copiez la clé manuellement.');
              }
            }}
          >
            <Copy size={15} />
            Copier
          </button>
          <div className="modal-footer">
            <button className="button primary" onClick={() => setKey('')}>
              J’ai conservé la clé
            </button>
          </div>
        </Modal>
      )}
      {editor && (
        <EntityEditor
          entity="devices"
          row={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
