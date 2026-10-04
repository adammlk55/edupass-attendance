'use client';
import { useState } from 'react';
import { entitySchemas } from '@/lib/validation';
import { type Entity, type Row, name, weekdays } from '@/lib/types';
import { useSchool } from './school-provider';
import { Modal } from './ui';
type Field = { key: string; label: string; type?: string; ref?: Entity; optional?: boolean };
export const fields: Record<Entity, Field[]> = {
  students: [
    { key: 'first_name', label: 'Prénom' },
    { key: 'last_name', label: 'Nom' },
    { key: 'massar_code', label: 'Code Massar' },
    { key: 'class_id', label: 'Classe', ref: 'classes' },
    { key: 'card_uid', label: 'UID de la carte NFC', optional: true },
  ],
  teachers: [
    { key: 'first_name', label: 'Prénom' },
    { key: 'last_name', label: 'Nom' },
    { key: 'teacher_code', label: 'Code professeur' },
    { key: 'card_uid', label: 'UID de la carte NFC', optional: true },
  ],
  classes: [
    { key: 'name', label: 'Nom de la classe' },
    { key: 'academic_year', label: 'Année scolaire (2026-2027)' },
  ],
  subjects: [
    { key: 'name', label: 'Nom de la matière' },
    { key: 'code', label: 'Code matière' },
  ],
  rooms: [
    { key: 'name', label: 'Nom de la salle' },
    { key: 'building', label: 'Bâtiment', optional: true },
    { key: 'floor', label: 'Étage', type: 'number', optional: true },
  ],
  devices: [
    { key: 'name', label: 'Nom de l’appareil' },
    { key: 'device_code', label: 'Code de l’appareil' },
    { key: 'room_id', label: 'Salle', ref: 'rooms' },
  ],
  timetable: [
    { key: 'teacher_id', label: 'Professeur', ref: 'teachers' },
    { key: 'subject_id', label: 'Matière', ref: 'subjects' },
    { key: 'class_id', label: 'Classe', ref: 'classes' },
    { key: 'room_id', label: 'Salle', ref: 'rooms' },
    { key: 'day_of_week', label: 'Jour', type: 'day' },
    { key: 'start_time', label: 'Début', type: 'time' },
    { key: 'end_time', label: 'Fin', type: 'time' },
  ],
};
const singular: Record<Entity, string> = {
  students: 'un élève',
  teachers: 'un professeur',
  classes: 'une classe',
  subjects: 'une matière',
  rooms: 'une salle',
  devices: 'un appareil',
  timetable: 'un cours',
};
export function EntityEditor({
  entity,
  row,
  onClose,
}: {
  entity: Entity;
  row?: Row;
  onClose: () => void;
}) {
  const { data, mutate, setNotice } = useSchool();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`${row ? 'Modifier' : 'Ajouter'} ${singular[entity]}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const f = new FormData(e.currentTarget);
          const p: Record<string, unknown> = { active: f.get('active') === 'on' };
          for (const field of fields[entity]) {
            const v = String(f.get(field.key) ?? '').trim();
            p[field.key] =
              !v && field.optional
                ? null
                : ['number', 'day'].includes(field.type ?? '')
                  ? Number(v)
                  : v;
          }
          try {
            const parsed = entitySchemas[entity].safeParse(p);
            if (!parsed.success) throw new Error(parsed.error.issues[0].message);
            await mutate(`${entity}${row ? `/${row.id}` : ''}`, parsed.data);
            setNotice(row ? 'Modifications enregistrées.' : 'Élément ajouté avec succès.');
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {fields[entity].map((field) => (
            <label key={field.key}>
              {field.label}
              {field.optional && <span className="optional"> · facultatif</span>}
              {field.ref ? (
                <select name={field.key} defaultValue={String(row?.[field.key] ?? '')} required>
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {data[field.ref]
                    .filter((r) => r.active || r.id === row?.[field.key])
                    .map((r) => (
                      <option value={r.id} key={r.id}>
                        {name(r)}
                        {!r.active ? ' (inactif)' : ''}
                      </option>
                    ))}
                </select>
              ) : field.type === 'day' ? (
                <select name={field.key} defaultValue={String(row?.[field.key] ?? 1)}>
                  {weekdays.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  autoFocus={field === fields[entity][0]}
                  type={field.type ?? 'text'}
                  name={field.key}
                  defaultValue={String(
                    row?.[field.key] ?? (field.key === 'academic_year' ? '2026-2027' : ''),
                  )}
                  required={!field.optional}
                  maxLength={120}
                  min={field.type === 'number' ? -5 : undefined}
                  max={field.type === 'number' ? 100 : undefined}
                />
              )}
            </label>
          ))}
        </div>
        <label className="check-label">
          <input type="checkbox" name="active" defaultChecked={row ? Boolean(row.active) : true} />{' '}
          {entity === 'timetable' ? 'Cours actif' : 'Actif'}
        </label>
        {entity === 'devices' && (
          <p className="form-help">
            Après l’ajout, ouvrez la fiche de l’appareil pour générer sa clé d’authentification.
          </p>
        )}
        {entity === 'timetable' && (
          <p className="form-help">
            Horaires de l’établissement · {data.settings.timezone}. Les conflits de professeur,
            classe et salle sont bloqués.
          </p>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button" onClick={onClose}>
            Annuler
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
