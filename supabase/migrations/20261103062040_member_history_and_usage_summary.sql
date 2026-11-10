begin;
-- Private schema: verified Supabase identities are set by the server, not clients.
create table banglog_plus.member_history (
 id uuid primary key, user_id uuid not null, analysis_id uuid not null,
 input jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 days',
 unique(user_id, analysis_id)
);
create index member_history_owner_date on banglog_plus.member_history(user_id,created_at desc);
create index member_history_expiry on banglog_plus.member_history(expires_at);
alter table banglog_plus.member_history enable row level security;
alter table banglog_plus.member_history force row level security;
create policy history_read on banglog_plus.member_history for select to banglog_plus_server
 using(user_id=nullif(current_setting('banglog.user_id',true),'')::uuid or (current_setting('banglog.cleanup',true)='true' and expires_at<=now()));
create policy history_insert on banglog_plus.member_history for insert to banglog_plus_server
 with check(user_id=nullif(current_setting('banglog.user_id',true),'')::uuid and expires_at<=now()+interval '90 days');
create policy history_delete on banglog_plus.member_history for delete to banglog_plus_server
 using(user_id=nullif(current_setting('banglog.user_id',true),'')::uuid or expires_at<=now());
grant select,insert,delete on banglog_plus.member_history to banglog_plus_server;
-- No user/session IDs or free text. Counts measure completed analyses, not people.
create table banglog_plus.usage_daily_summary (
 day date not null, issue text not null, observation text not null,
 direction text not null, mode text not null check(mode in ('mock','live')),
 completed bigint not null default 1 check(completed>0),
 primary key(day,issue,observation,direction,mode)
);
alter table banglog_plus.usage_daily_summary enable row level security;
alter table banglog_plus.usage_daily_summary force row level security;
create policy summary_server on banglog_plus.usage_daily_summary to banglog_plus_server
 using(true) with check(day=(now() at time zone 'Asia/Seoul')::date);
grant select,insert,update on banglog_plus.usage_daily_summary to banglog_plus_server;
revoke all on banglog_plus.member_history,banglog_plus.usage_daily_summary from public;
do $$ declare r text; begin foreach r in array array['anon','authenticated'] loop if exists(select 1 from pg_roles where rolname=r) then execute format('revoke all on banglog_plus.member_history,banglog_plus.usage_daily_summary from %I',r); end if; end loop; end $$;

create table banglog_plus.answer_daily_summary (
 day date not null, issue text not null, question text not null, answer text not null,
 mode text not null check(mode in ('mock','live')), completed bigint not null default 1 check(completed>0),
 primary key(day,issue,question,answer,mode)
);
alter table banglog_plus.answer_daily_summary enable row level security;
alter table banglog_plus.answer_daily_summary force row level security;
create policy answers_server on banglog_plus.answer_daily_summary to banglog_plus_server
 using(true) with check(day=(now() at time zone 'Asia/Seoul')::date);
grant select,insert,update on banglog_plus.answer_daily_summary to banglog_plus_server;
revoke all on banglog_plus.answer_daily_summary from public;
commit;
