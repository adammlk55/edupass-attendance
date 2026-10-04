-- Optional sample data; no accounts or device keys are created.
insert into public.classes(id,name,academic_year) values('10000000-0000-4000-8000-000000000001','2BAC STE','2026-2027');
insert into public.subjects(id,name,code) values('10000000-0000-4000-8000-000000000002','Mathématiques','MATH');
insert into public.rooms(id,name,building,floor) values('10000000-0000-4000-8000-000000000003','Salle 12','Bâtiment A',1);
insert into public.teachers(id,first_name,last_name,teacher_code,card_uid) values('10000000-0000-4000-8000-000000000004','Ahmed','Bennani','PROF_001','PROF_001');
insert into public.students(id,first_name,last_name,massar_code,card_uid,class_id) values
('10000000-0000-4000-8000-000000000005','Yassine','El Mansouri','M13562489','CARD_001','10000000-0000-4000-8000-000000000001'),
('10000000-0000-4000-8000-000000000006','Salma','Bennani','M24871953','CARD_002','10000000-0000-4000-8000-000000000001');
insert into public.devices(id,device_code,room_id,name) values('10000000-0000-4000-8000-000000000007','DEVICE_012','10000000-0000-4000-8000-000000000003','Borne Salle 12');
insert into public.timetable(id,teacher_id,subject_id,class_id,room_id,day_of_week,start_time,end_time) values('10000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',1,'08:00','09:00');
