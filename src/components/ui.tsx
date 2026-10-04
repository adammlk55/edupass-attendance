'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, Inbox } from 'lucide-react';
export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const labels: Record<string, string> = {
    present: 'Présent',
    late: 'En retard',
    absent: 'Absent',
    excused: 'Justifiée',
    open: 'En cours',
    closed: 'Terminée',
    cancelled: 'Annulée',
    online: 'En ligne',
    offline: 'Hors ligne',
    active: 'Actif',
    inactive: 'Inactif',
    pending: 'À synchroniser',
  };
  return (
    <span className={`badge ${status ?? ''}`}>
      <i />
      {children ?? labels[status ?? ''] ?? status}
    </span>
  );
}
export function Avatar({
  first,
  last,
  color = 0,
}: {
  first: string;
  last?: string;
  color?: number;
}) {
  return (
    <span className={`avatar color-${color % 5}`}>
      {first.charAt(0)}
      {last?.charAt(0)}
    </span>
  );
}
export function Empty({
  title = 'Aucun résultat',
  description = 'Ajustez vos filtres ou ajoutez un premier élément.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose} aria-label={title}>
      <div className="modal-title">
        <h2>{title}</h2>
        <button onClick={onClose} className="icon-button" aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function csvDownload(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) =>
    `"${String(v ?? '')
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const text =
    '\uFEFF' +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(cell).join(';'))
      .join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
