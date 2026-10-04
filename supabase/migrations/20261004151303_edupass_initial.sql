-- EduPass / PostgreSQL 15+. Apply through the generated migration.
create schema if not exists private;
create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, role text not null default 'staff' check (role in ('admin','staff')),
 active boolean not null default true, created_at timestamptz not null default now()
);
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.users where id = (select auth.uid()) and active);
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.users where id = (select auth.uid()) and active and role = 'admin');
$$;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
revoke all on function private.is_staff(), private.is_admin() from public;
grant execute on function private.is_staff(), private.is_admin() to authenticated, service_role;

create table public.classes (id uuid primary key default gen_random_uuid(), name text not null, academic_year text not null, active boolean not null default true, unique(name, academic_year));
create table public.subjects (id uuid primary key default gen_random_uuid(), name text not null, code text not null unique, active boolean not null default true);
create table public.rooms (id uuid primary key default gen_random_uuid(), name text not null unique, building text, floor integer, active boolean not null default true);
create table public.teachers (
 id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null,
 teacher_code text not null unique, card_uid text unique, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.students (
 id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null,
 massar_code text not null unique, card_uid text unique, photo_url text, class_id uuid not null references public.classes(id),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.settings (
 id integer primary key default 1 check(id=1), school_name text not null default 'Mon établissement',
 timezone text not null default 'Africa/Casablanca', late_minutes integer not null default 10 check(late_minutes between 0 and 60)
);
insert into public.settings default values;
create table public.devices (
 id uuid primary key default gen_random_uuid(), device_code text not null unique, room_id uuid not null unique references public.rooms(id),
 name text not null, firmware_version text, last_seen_at timestamptz, last_sync_at timestamptz,
 local_data_version bigint not null default 0, status text not null default 'offline' check(status in ('online','offline')),
 active boolean not null default true, force_sync_id uuid, pending_uploads integer not null default 0 check(pending_uploads>=0), created_at timestamptz not null default now()
);
create table private.device_keys (device_id uuid primary key references public.devices(id) on delete cascade, key_hash text not null unique, updated_at timestamptz not null default now());
create table public.timetable (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teachers(id), subject_id uuid not null references public.subjects(id),
 class_id uuid not null references public.classes(id), room_id uuid not null references public.rooms(id),
 day_of_week integer not null check(day_of_week between 1 and 7), start_time time not null, end_time time not null,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_time > start_time)
);
-- Serialize schedule edits; conflicts remain safe under concurrent admin requests.
create function private.check_timetable() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(702001);
 if new.active and exists(select 1 from public.timetable t where t.active and t.id<>new.id and t.day_of_week=new.day_of_week
   and t.start_time<new.end_time and t.end_time>new.start_time and (t.teacher_id=new.teacher_id or t.class_id=new.class_id or t.room_id=new.room_id)) then
   raise exception 'TIMETABLE_CONFLICT' using errcode='23P01';
 end if;
 if new.active and not (exists(select 1 from public.teachers where id=new.teacher_id and active)
 and exists(select 1 from public.classes where id=new.class_id and active)
 and exists(select 1 from public.subjects where id=new.subject_id and active)
 and exists(select 1 from public.rooms where id=new.room_id and active)) then raise exception 'INACTIVE_REFERENCE'; end if;
 return new;
end $$;
create trigger timetable_conflict before insert or update on public.timetable for each row execute function private.check_timetable();
create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end $$;
create trigger teachers_updated before update on public.teachers for each row execute function private.touch_updated_at();
create trigger students_updated before update on public.students for each row execute function private.touch_updated_at();
create trigger timetable_updated before update on public.timetable for each row execute function private.touch_updated_at();
-- One NFC UID identifies exactly one person, including across both person tables.
create function private.check_card() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(702002);
 new.card_uid:=nullif(upper(trim(new.card_uid)),'');
 if new.card_uid is not null then
  if length(new.card_uid)>64 or new.card_uid !~ '^[A-Z0-9:_-]+$' then raise exception 'INVALID_CARD' using errcode='23514'; end if;
  if (tg_table_name='students' and exists(select 1 from public.teachers where card_uid=new.card_uid))
   or (tg_table_name='teachers' and exists(select 1 from public.students where card_uid=new.card_uid)) then raise exception 'CARD_ALREADY_ASSIGNED' using errcode='23505'; end if;
 end if;
 return new;
end $$;
create trigger students_card before insert or update on public.students for each row execute function private.check_card();
create trigger teachers_card before insert or update on public.teachers for each row execute function private.check_card();
create table public.sessions (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teachers(id), subject_id uuid not null references public.subjects(id),
 class_id uuid not null references public.classes(id), room_id uuid not null references public.rooms(id), device_id uuid not null references public.devices(id),
 timetable_id uuid references public.timetable(id), start_time timestamptz not null, end_time timestamptz not null,
 opened_at timestamptz not null, status text not null default 'open' check(status in ('open','closed','cancelled')),
 data_version bigint not null, late_minutes integer not null, created_at timestamptz not null default now(),
 unique(device_id,timetable_id,start_time), check(end_time>start_time)
);
create table public.session_students (
 session_id uuid not null references public.sessions(id), student_id uuid not null references public.students(id), card_uid text,
 primary key(session_id,student_id), unique(session_id,card_uid)
);
create table private.session_aliases (
 device_id uuid not null references public.devices(id), local_id text not null, session_id uuid not null references public.sessions(id),
 request jsonb not null, primary key(device_id,local_id)
);
create table public.attendance (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.sessions(id), student_id uuid not null references public.students(id),
 device_id uuid not null references public.devices(id), scanned_at timestamptz, status text not null check(status in ('present','late','absent','excused')),
 source text not null check(source in ('nfc','mobile_ble','manual_admin')), synced_at timestamptz not null default now(), created_at timestamptz not null default now(),
 unique(session_id,student_id), foreign key(session_id,student_id) references public.session_students(session_id,student_id)
);
create table private.upload_receipts (
 device_id uuid not null references public.devices(id), local_id text not null, request jsonb not null, response jsonb not null,
 created_at timestamptz not null default now(), primary key(device_id,local_id)
);
create table public.sync_versions (id integer primary key check(id=1), version bigint not null default 0, updated_at timestamptz not null default now());
insert into public.sync_versions values(1,0,now());
create table public.sync_changes (
 id bigint generated always as identity primary key, version bigint not null unique, entity_type text not null, entity_id text not null,
 action text not null check(action in ('create','update','delete')), payload jsonb not null, created_at timestamptz not null default now()
);
create table private.sync_deliveries (device_id uuid not null references public.devices(id), version bigint not null, force_sync_id uuid, primary key(device_id,version));

create function private.track_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v bigint; p jsonb; oldp jsonb;
begin
 p := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='devices' then
   p := p - array['firmware_version','last_seen_at','last_sync_at','local_data_version','status','force_sync_id','pending_uploads'];
   if tg_op='UPDATE' then
     oldp:=to_jsonb(old)-array['firmware_version','last_seen_at','last_sync_at','local_data_version','status','force_sync_id','pending_uploads'];
     if oldp=p then return new; end if;
   end if;
 end if;
 update public.sync_versions set version=version+1, updated_at=now() where id=1 returning version into v;
 insert into public.sync_changes(version,entity_type,entity_id,action,payload)
 values(v,tg_table_name,p->>'id',case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'update' end,p);
 return coalesce(new,old);
end $$;
revoke all on function private.track_change() from public;
do $$ declare t text; begin
 foreach t in array array['teachers','students','classes','subjects','rooms','devices','timetable','settings'] loop
   execute format('create trigger track_sync after insert or update or delete on public.%I for each row execute function private.track_change()',t);
 end loop;
end $$;
-- Settings existed before the trigger.
update public.settings set id=id;

create function private.bundle(p_device uuid,p_version bigint) returns jsonb language sql stable set search_path='' as $$
 with latest as (
  select distinct on(entity_type,entity_id) entity_type,entity_id,action,payload from public.sync_changes where version<=p_version order by entity_type,entity_id,version desc
 ), live as (select * from latest where action<>'delete' and coalesce((payload->>'active')::boolean,true)),
 d as (select payload from live where entity_type='devices' and entity_id=p_device::text),
 tt as (select l.payload from live l,d where entity_type='timetable' and l.payload->>'room_id'=d.payload->>'room_id'
   and exists(select 1 from live r where r.entity_type='rooms' and r.entity_id=l.payload->>'room_id')
   and exists(select 1 from live r where r.entity_type='teachers' and r.entity_id=l.payload->>'teacher_id')
   and exists(select 1 from live r where r.entity_type='classes' and r.entity_id=l.payload->>'class_id')
   and exists(select 1 from live r where r.entity_type='subjects' and r.entity_id=l.payload->>'subject_id'))
 select jsonb_build_object(
 'device',(select payload from d),
 'settings',coalesce((select payload from live where entity_type='settings'),'{}'::jsonb),
 'rooms',coalesce((select jsonb_agg(l.payload order by entity_id) from live l,d where entity_type='rooms' and entity_id=d.payload->>'room_id'),'[]'::jsonb),
 'timetable',coalesce((select jsonb_agg(payload order by payload->>'id') from tt),'[]'::jsonb),
 'teachers',coalesce((select jsonb_agg(payload order by entity_id) from live where entity_type='teachers' and entity_id in(select payload->>'teacher_id' from tt)),'[]'::jsonb),
 'classes',coalesce((select jsonb_agg(payload order by entity_id) from live where entity_type='classes' and entity_id in(select payload->>'class_id' from tt)),'[]'::jsonb),
 'subjects',coalesce((select jsonb_agg(payload order by entity_id) from live where entity_type='subjects' and entity_id in(select payload->>'subject_id' from tt)),'[]'::jsonb),
 'students',coalesce((select jsonb_agg(payload order by entity_id) from live where entity_type='students' and payload->>'class_id' in(select payload->>'class_id' from tt)),'[]'::jsonb))
$$;
create function private.flatten_bundle(b jsonb) returns table(entity text,id text,payload jsonb) language sql immutable as $$
 select x.key, r.value->>'id', r.value from jsonb_each(b) x cross join lateral jsonb_array_elements(
 case when jsonb_typeof(x.value)='array' then x.value when jsonb_typeof(x.value)='object' then jsonb_build_array(x.value) else '[]'::jsonb end) r
$$;

create function public.device_auth(p_code text,p_hash text) returns uuid language sql security invoker set search_path='' as $$
 select d.id from public.devices d join private.device_keys k on k.device_id=d.id where d.device_code=p_code and d.active and k.key_hash=p_hash
$$;
create function public.device_sync(p_device uuid,p_mode text,p_version bigint default 0,p_force uuid default null,p_pending integer default 0) returns jsonb language plpgsql set search_path='' as $$
declare v bigint; d public.devices; b jsonb; prev jsonb; changes jsonb;
begin
 select version into v from public.sync_versions where id=1 for share;
 select * into d from public.devices where id=p_device and active for update;
 if not found then raise exception 'DEVICE_NOT_FOUND'; end if;
 if p_version<0 or p_version>v then raise exception 'INVALID_VERSION'; end if;
 update public.devices set last_seen_at=now(), status='online' where id=p_device;
 if p_mode='ack' then
   if not exists(select 1 from private.sync_deliveries where device_id=p_device and version=p_version and force_sync_id is not distinct from p_force) then raise exception 'SYNC_NOT_DELIVERED'; end if;
   update public.devices set local_data_version=greatest(local_data_version,p_version),last_sync_at=now(),pending_uploads=p_pending,
    force_sync_id=case when force_sync_id is not distinct from p_force then null else force_sync_id end where id=p_device;
   return jsonb_build_object('ok',true);
 end if;
 if p_mode='check' then return jsonb_build_object('update_available',p_version<>v or d.force_sync_id is not null,'server_version',v,'force_full_sync',d.force_sync_id is not null); end if;
 b:=private.bundle(p_device,v);
 insert into private.sync_deliveries values(p_device,v,d.force_sync_id) on conflict(device_id,version) do update set force_sync_id=excluded.force_sync_id;
 if p_mode='full' then return b||jsonb_build_object('version',v,'force_sync_id',d.force_sync_id); end if;
 if p_mode<>'changes' then raise exception 'INVALID_MODE'; end if;
 if d.force_sync_id is not null or p_version=0 then return jsonb_build_object('full_sync_required',true,'server_version',v); end if;
 prev:=private.bundle(p_device,p_version);
 select coalesce(jsonb_agg(jsonb_build_object('entity_type',coalesce(n.entity,o.entity),'entity_id',coalesce(n.id,o.id),
 'action',case when n.id is null then 'delete' when o.id is null then 'create' else 'update' end,'payload',n.payload) order by coalesce(n.entity,o.entity),coalesce(n.id,o.id)),'[]'::jsonb)
 into changes from private.flatten_bundle(prev) o full join private.flatten_bundle(b) n on n.entity=o.entity and n.id=o.id where n.payload is distinct from o.payload;
 return jsonb_build_object('from_version',p_version,'to_version',v,'changes',changes,'force_sync_id',d.force_sync_id);
end $$;

create function public.device_open_session(p_device uuid,p_card text,p_timestamp timestamptz,p_local_id text default null,p_version bigint default null) returns jsonb language plpgsql set search_path='' as $$
declare v bigint; b jsonb; teacher jsonb; lesson jsonb; cfg jsonb; local_time timestamp; s public.sessions; sid uuid; req jsonb; previous private.session_aliases;
begin
 perform pg_advisory_xact_lock(hashtext(p_device::text));
 req:=jsonb_build_object('card',p_card,'timestamp',p_timestamp,'version',p_version);
 if p_local_id is not null then
  select * into previous from private.session_aliases where device_id=p_device and local_id=p_local_id;
  if found then
   if previous.request<>req then raise exception 'LOCAL_ID_CONFLICT'; end if;
   select * into s from public.sessions where id=previous.session_id;
   return jsonb_build_object('ok',true,'session',to_jsonb(s));
  end if;
 end if;
 if p_timestamp>now()+interval '5 minutes' or p_timestamp<now()-interval '30 days' then raise exception 'INVALID_TIMESTAMP'; end if;
 select version into v from public.sync_versions where id=1 for share;
 if p_version is not null and (p_version<=0 or p_version>v) then raise exception 'INVALID_VERSION'; end if;
 v:=coalesce(p_version,v); b:=private.bundle(p_device,v); cfg:=b->'settings';
 if p_version is not null and not exists(select 1 from private.sync_deliveries where device_id=p_device and version=v) then raise exception 'SYNC_NOT_DELIVERED'; end if;
 if b->'device'='null'::jsonb then raise exception 'DEVICE_NOT_FOUND'; end if;
 select value into teacher from jsonb_array_elements(b->'teachers') where value->>'card_uid'=p_card;
 if teacher is null then raise exception 'TEACHER_NOT_FOUND'; end if;
 local_time:=p_timestamp at time zone (cfg->>'timezone');
 select value into lesson from jsonb_array_elements(b->'timetable') where value->>'teacher_id'=teacher->>'id'
 and (value->>'day_of_week')::int=extract(isodow from local_time) and local_time::time >= (value->>'start_time')::time and local_time::time < (value->>'end_time')::time;
 if lesson is null then raise exception 'NO_SCHEDULED_LESSON'; end if;
 insert into public.sessions(teacher_id,subject_id,class_id,room_id,device_id,timetable_id,start_time,end_time,opened_at,data_version,late_minutes)
 values((lesson->>'teacher_id')::uuid,(lesson->>'subject_id')::uuid,(lesson->>'class_id')::uuid,(lesson->>'room_id')::uuid,p_device,(lesson->>'id')::uuid,
 (local_time::date+(lesson->>'start_time')::time) at time zone (cfg->>'timezone'),(local_time::date+(lesson->>'end_time')::time) at time zone (cfg->>'timezone'),p_timestamp,v,(cfg->>'late_minutes')::int)
 on conflict(device_id,timetable_id,start_time) do nothing returning id into sid;
 if sid is not null then
  insert into public.session_students select sid,(value->>'id')::uuid,value->>'card_uid' from jsonb_array_elements(b->'students') where value->>'class_id'=lesson->>'class_id';
 else
  select id into sid from public.sessions where device_id=p_device and timetable_id=(lesson->>'id')::uuid and start_time=(local_time::date+(lesson->>'start_time')::time) at time zone (cfg->>'timezone');
 end if;
 select * into s from public.sessions where id=sid;
 if s.status='cancelled' then raise exception 'SESSION_CANCELLED'; end if;
 if p_local_id is not null then insert into private.session_aliases values(p_device,p_local_id,sid,req); end if;
 return jsonb_build_object('ok',true,'session',to_jsonb(s));
end $$;

create function public.device_attendance(p_device uuid,p_record jsonb) returns jsonb language plpgsql set search_path='' as $$
declare sid uuid; s public.sessions; st public.students; a public.attendance; scan_time timestamptz; result jsonb; previous private.upload_receipts; localid text;
begin
 perform pg_advisory_xact_lock(hashtext(p_device::text));
 localid:=p_record->>'local_id';
 if localid is not null then
  select * into previous from private.upload_receipts where device_id=p_device and local_id=localid;
  if found then
   if previous.request<>p_record then raise exception 'LOCAL_ID_CONFLICT'; end if;
   return previous.response||jsonb_build_object('duplicate',true);
  end if;
 end if;
 sid:=(p_record->>'session_id')::uuid;
 if sid is null then select session_id into sid from private.session_aliases where device_id=p_device and local_id=p_record->>'session_local_id'; end if;
 select * into s from public.sessions where id=sid and device_id=p_device for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if s.status='cancelled' then raise exception 'SESSION_CANCELLED'; end if;
 scan_time:=(p_record->>'scanned_at')::timestamptz;
 if scan_time is null or scan_time<s.opened_at or scan_time<s.start_time or scan_time>=s.end_time or scan_time>now()+interval '5 minutes' or scan_time<now()-interval '30 days' then raise exception 'INVALID_TIMESTAMP'; end if;
 select st0.* into st from public.students st0 join public.session_students ss on ss.student_id=st0.id where ss.session_id=s.id and ss.card_uid=p_record->>'student_card_uid';
 if not found then raise exception 'STUDENT_NOT_IN_CLASS'; end if;
 insert into public.attendance(session_id,student_id,device_id,scanned_at,status,source)
 values(s.id,st.id,p_device,scan_time,case when scan_time<=s.start_time+make_interval(mins=>s.late_minutes) then 'present' else 'late' end,coalesce(p_record->>'source','nfc'))
 on conflict(session_id,student_id) do update set scanned_at=excluded.scanned_at,status=excluded.status,source=excluded.source,synced_at=now()
 where attendance.status='absent' or (attendance.source<>'manual_admin' and excluded.scanned_at<attendance.scanned_at)
 returning * into a;
 if a.id is null then select * into a from public.attendance where session_id=s.id and student_id=st.id; end if;
 result:=jsonb_build_object('ok',true,'attendance_id',a.id,'student',jsonb_build_object('id',st.id,'name',st.first_name||' '||st.last_name,'massar_code',st.massar_code),'status',a.status);
 if localid is not null then insert into private.upload_receipts values(p_device,localid,p_record,result,now()); end if;
 update public.devices set last_seen_at=now(),status='online' where id=p_device;
 return result;
end $$;
create function public.finalize_sessions(p_session uuid default null) returns integer language plpgsql set search_path='' as $$
declare s public.sessions; n integer:=0;
begin
 for s in select * from public.sessions where status='open' and end_time<=now() and (p_session is null or id=p_session) for update loop
  insert into public.attendance(session_id,student_id,device_id,status,source)
  select s.id,student_id,s.device_id,'absent','nfc' from public.session_students where session_id=s.id on conflict(session_id,student_id) do nothing;
  update public.sessions set status='closed' where id=s.id; n:=n+1;
 end loop;
 return n;
end $$;
create function public.set_device_key(p_device uuid,p_hash text) returns void language sql set search_path='' as $$
 insert into private.device_keys values(p_device,p_hash,now()) on conflict(device_id) do update set key_hash=excluded.key_hash,updated_at=now();
$$;

create index students_class_idx on public.students(class_id);
create index timetable_room_day_idx on public.timetable(room_id,day_of_week,start_time) where active;
create index timetable_teacher_idx on public.timetable(teacher_id);
create index timetable_class_idx on public.timetable(class_id);
create index timetable_subject_idx on public.timetable(subject_id);
create index sessions_date_idx on public.sessions(start_time desc);
create index sessions_teacher_idx on public.sessions(teacher_id);
create index sessions_subject_idx on public.sessions(subject_id);
create index sessions_class_idx on public.sessions(class_id);
create index sessions_room_idx on public.sessions(room_id);
create index sessions_timetable_idx on public.sessions(timetable_id);
create index session_students_student_idx on public.session_students(student_id);
create index attendance_student_idx on public.attendance(student_id,scanned_at desc);
create index attendance_scanned_idx on public.attendance(scanned_at desc);
create index attendance_device_idx on public.attendance(device_id);
create index sync_history_idx on public.sync_changes(entity_type,entity_id,version desc);
create index session_alias_session_idx on private.session_aliases(session_id);

-- No anonymous school data. Staff can read; only admins manage reference data.
do $$ declare t text; begin
 foreach t in array array['users','classes','subjects','rooms','teachers','students','devices','timetable','sessions','session_students','attendance','settings','sync_versions','sync_changes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_staff()))',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['classes','subjects','rooms','teachers','students','devices','timetable','settings'] loop
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy admin_write on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
 end loop;
 foreach t in array array['device_keys','session_aliases','upload_receipts','sync_deliveries'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('grant all on private.%I to service_role',t);
 end loop;
end $$;
grant usage,select on all sequences in schema public to service_role;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;
revoke all on function private.bundle(uuid,bigint),private.flatten_bundle(jsonb),private.check_timetable() from public;
grant execute on function private.bundle(uuid,bigint),private.flatten_bundle(jsonb) to service_role;
revoke all on function private.touch_updated_at() from public;
revoke all on function private.check_card() from public;
