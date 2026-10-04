'use client';
import { useState } from 'react';
import { Plus, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { useSchool } from './school-provider';
import { EntityEditor } from './entity-editor';
import { Empty } from './ui';
import { type Row, lookup, name, weekdays } from '@/lib/types';
export function Timetable({ classId, embedded = false }: { classId?: string; embedded?: boolean }) {
  const { data } = useSchool();
  const [teacher, setTeacher] = useState('');
  const [classFilter, setClassFilter] = useState(classId ?? '');
  const [editor, setEditor] = useState<Row | 'new' | null>(null);
  const lessons = data.timetable.filter(
    (t) =>
      t.active &&
      (!teacher || t.teacher_id === teacher) &&
      (!classFilter || t.class_id === classFilter),
  );
  return (
    <div className={embedded ? 'embedded' : 'page'}>
      {!embedded && (
        <div className="page-heading">
          <div>
            <span className="eyebrow">ORGANISATION PÉDAGOGIQUE</span>
            <h1>Emploi du temps</h1>
            <p>Une semaine organisée, des classes bien accompagnées.</p>
          </div>
          {data.role === 'admin' && (
            <button className="button primary" onClick={() => setEditor('new')}>
              <Plus size={17} />
              Planifier un cours
            </button>
          )}
        </div>
      )}
      <section className="panel">
        <div className="filter-bar">
          <span className="calendar-label">
            <CalendarDays size={18} />
            Semaine type
          </span>
          <div className="filter-selects">
            <select
              aria-label="Filtrer par professeur"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
            >
              <option value="">Tous les professeurs</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {name(t)}
                </option>
              ))}
            </select>
            {!classId && (
              <select
                aria-label="Filtrer par classe"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">Toutes les classes</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="calendar-scroll">
          <div className="week-calendar">
            {weekdays.map((day, i) => (
              <div className="calendar-day" key={day}>
                <h3>
                  {day}
                  <span>{lessons.filter((t) => t.day_of_week === i + 1).length}</span>
                </h3>
                <div className="day-lessons">
                  {lessons
                    .filter((t) => t.day_of_week === i + 1)
                    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
                    .map((t, j) => (
                      <button
                        className={`calendar-lesson color-${j % 5}`}
                        key={t.id}
                        onClick={() => data.role === 'admin' && setEditor(t)}
                        disabled={data.role !== 'admin'}
                        aria-label={`Modifier ${lookup(data, 'subjects', t.subject_id)}, ${day}, ${String(t.start_time).slice(0, 5)}`}
                      >
                        <span className="calendar-time">
                          <Clock3 size={12} />
                          {String(t.start_time).slice(0, 5)} – {String(t.end_time).slice(0, 5)}
                        </span>
                        <strong>{lookup(data, 'subjects', t.subject_id)}</strong>
                        <span>{lookup(data, 'classes', t.class_id)}</span>
                        <small>{lookup(data, 'teachers', t.teacher_id)}</small>
                        <small>
                          <MapPin size={12} />
                          {lookup(data, 'rooms', t.room_id)}
                        </small>
                      </button>
                    ))}
                  {!lessons.some((t) => t.day_of_week === i + 1) && (
                    <div className="day-empty">Aucun cours</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="calendar-foot">
          Heure locale : {data.settings.timezone} · Cliquez sur un cours pour le modifier ou le
          désactiver.
        </div>
      </section>
      {!lessons.length && !embedded && (
        <Empty
          title="Votre semaine est encore libre"
          description="Planifiez un premier cours avec un professeur, une classe et une salle."
        />
      )}
      {editor && (
        <EntityEditor
          entity="timetable"
          row={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
