'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Users,
  BookOpen,
  Download,
} from 'lucide-react';
import { useSchool } from './school-provider';
import { EntityEditor, fields } from './entity-editor';
import { Badge, Avatar, Empty, csvDownload } from './ui';
import { type Entity, type Row, labels, name, lookup } from '@/lib/types';
const descriptions: Record<string, string> = {
  students: 'Les élèves de votre établissement, réunis au même endroit.',
  teachers: 'Gérez votre équipe pédagogique et ses cartes NFC.',
  classes: 'Organisez les classes et retrouvez leurs informations.',
  subjects: 'Le référentiel des matières enseignées.',
  rooms: 'Vos espaces d’apprentissage et leur organisation.',
};
export function EntityList({ entity }: { entity: Entity }) {
  const { data } = useSchool();
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<Row | 'new' | null>(null);
  const filtered = data[entity].filter(
    (r) =>
      (!query ||
        Object.values(r).some((v) =>
          String(v ?? '')
            .toLocaleLowerCase('fr')
            .includes(query.toLocaleLowerCase('fr')),
        )) &&
      (!classId || r.class_id === classId) &&
      (!status || String(r.active) === status),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  function filtersChanged() {
    setPage(0);
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ÉTABLISSEMENT</span>
          <h1>
            {labels[entity]} <span className="count-pill">{data[entity].length}</span>
          </h1>
          <p>{descriptions[entity]}</p>
        </div>
        <div className="heading-actions">
          <button
            className="button"
            disabled={!filtered.length}
            onClick={() =>
              csvDownload(
                `${entity}.csv`,
                filtered.map((r) =>
                  Object.fromEntries(
                    fields[entity].map((f) => [
                      f.label,
                      f.ref ? lookup(data, f.ref, r[f.key]) : r[f.key],
                    ]),
                  ),
                ),
              )
            }
          >
            <Download size={16} />
            Exporter
          </button>
          {data.role === 'admin' && (
            <button className="button primary" onClick={() => setEditor('new')}>
              <Plus size={17} />
              Ajouter
            </button>
          )}
        </div>
      </div>
      <section className="panel">
        <div className="filter-bar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label={`Rechercher dans ${labels[entity]}`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                filtersChanged();
              }}
              placeholder={
                entity === 'students'
                  ? 'Rechercher un nom, un code Massar, une carte…'
                  : 'Rechercher…'
              }
            />
          </div>
          <div className="filter-selects">
            {entity === 'students' && (
              <select
                aria-label="Filtrer par classe"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  filtersChanged();
                }}
              >
                <option value="">Toutes les classes</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <SlidersHorizontal size={16} />
            <select
              aria-label="Filtrer par statut"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                filtersChanged();
              }}
            >
              <option value="">Tous les statuts</option>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
            </select>
          </div>
        </div>
        {entity === 'classes' ? (
          <div className="class-grid">
            {rows.map((r, i) => {
              const students = data.students.filter((s) => s.class_id === r.id && s.active);
              const sessions = new Set(
                data.sessions.filter((s) => s.class_id === r.id).map((s) => s.id),
              );
              const total = data.session_students.filter((s) =>
                sessions.has(String(s.session_id)),
              ).length;
              const present = data.attendance.filter(
                (a) =>
                  sessions.has(String(a.session_id)) &&
                  ['present', 'late'].includes(String(a.status)),
              ).length;
              return (
                <article className="class-card" key={r.id}>
                  <div className="class-card-top">
                    <span className={`class-icon color-${i % 5}`}>
                      <BookOpen size={23} />
                    </span>
                    <Badge status={r.active ? 'active' : 'inactive'} />
                  </div>
                  <Link href={`/classes/${r.id}`}>
                    <h2>
                      {r.name}
                      <ArrowUpRight size={17} />
                    </h2>
                  </Link>
                  <p>Année scolaire {r.academic_year}</p>
                  <div className="class-card-info">
                    <span>
                      <Users size={15} />
                      {students.length} élèves
                    </span>
                    <strong>
                      {total ? Math.round((present / total) * 100) + ' %' : '—'}
                      <small> de présence</small>
                    </strong>
                  </div>
                  <div className="class-card-footer">
                    <Link href={`/classes/${r.id}`}>
                      Voir la classe <ChevronRight size={14} />
                    </Link>
                    {data.role === 'admin' && (
                      <button
                        className="icon-button"
                        aria-label={`Modifier ${r.name}`}
                        onClick={() => setEditor(r)}
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {entity === 'students' ? 'Élève' : entity === 'teachers' ? 'Professeur' : 'Nom'}
                  </th>
                  {fields[entity]
                    .filter((f) => !['first_name', 'last_name', 'name'].includes(f.key))
                    .map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                  {entity === 'teachers' && <th>Matières / classes</th>}
                  <th>Statut</th>
                  {data.role === 'admin' && (
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <div className="person">
                        <Avatar
                          first={String(r.first_name ?? r.name)}
                          last={String(r.last_name ?? '')}
                          color={i}
                        />
                        <strong>{name(r)}</strong>
                      </div>
                    </td>
                    {fields[entity]
                      .filter((f) => !['first_name', 'last_name', 'name'].includes(f.key))
                      .map((f) => (
                        <td
                          key={f.key}
                          className={f.key.includes('code') || f.key === 'card_uid' ? 'mono' : ''}
                        >
                          {f.ref ? (
                            <span className="class-label">{lookup(data, f.ref, r[f.key])}</span>
                          ) : (
                            (r[f.key] ?? <span className="muted">Non renseigné</span>)
                          )}
                        </td>
                      ))}
                    {entity === 'teachers' && (
                      <td>
                        {
                          new Set(
                            data.timetable
                              .filter((t) => t.teacher_id === r.id && t.active)
                              .map((t) => t.subject_id),
                          ).size
                        }{' '}
                        matières ·{' '}
                        {
                          new Set(
                            data.timetable
                              .filter((t) => t.teacher_id === r.id && t.active)
                              .map((t) => t.class_id),
                          ).size
                        }{' '}
                        classes
                      </td>
                    )}
                    <td>
                      <Badge status={r.active ? 'active' : 'inactive'} />
                    </td>
                    {data.role === 'admin' && (
                      <td>
                        <button
                          className="icon-button"
                          onClick={() => setEditor(r)}
                          aria-label={`Modifier ${name(r)}`}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!rows.length && <Empty />}
        <div className="pagination">
          <span>
            {filtered.length
              ? `${currentPage * 10 + 1}–${Math.min((currentPage + 1) * 10, filtered.length)}`
              : '0'}{' '}
            sur {filtered.length} résultats
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Page précédente"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {currentPage + 1} / {pages}
            </span>
            <button
              className="icon-button"
              aria-label="Page suivante"
              disabled={currentPage >= pages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {editor && (
        <EntityEditor
          entity={entity}
          row={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
