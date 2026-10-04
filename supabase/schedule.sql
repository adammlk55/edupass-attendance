-- Run once in the NEW EduPass project's SQL editor after enabling pg_cron
-- under Integrations > Cron. Do not apply to an unrelated existing project.
select cron.schedule(
 'edupass-finalize-sessions',
 '* * * * *',
 'select public.finalize_sessions();'
);
-- Inspect execution: select * from cron.job_run_details order by start_time desc limit 20;
