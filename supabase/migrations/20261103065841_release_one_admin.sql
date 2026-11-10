begin;
create role banglog_plus_admin nologin nosuperuser nobypassrls;
grant usage on schema banglog_plus to banglog_plus_admin;
create table banglog_plus.members(user_id uuid primary key,email text,provider text,status text not null default 'active' check(status in ('active','blocked')),created_at timestamptz not null default now(),last_seen_at timestamptz not null default now());
create table banglog_plus.admin_sessions(token_hash text primary key,expires_at timestamptz not null,created_at timestamptz not null default now());
create table banglog_plus.admin_audit(id bigint generated always as identity primary key,action text not null,target text,reason text,created_at timestamptz not null default now());
create table banglog_plus.rate_limits(key text primary key,count integer not null,expires_at timestamptz not null);
create table banglog_plus.analysis_leases(id uuid primary key,expires_at timestamptz not null);
create table banglog_plus.operational_events(id bigint generated always as identity primary key,kind text not null,code text,model text,latency_ms integer,created_at timestamptz not null default now());
create index operational_created on banglog_plus.operational_events(created_at desc);
create index audit_created on banglog_plus.admin_audit(created_at desc);
create index members_seen on banglog_plus.members(last_seen_at desc);
create index admin_session_expiry on banglog_plus.admin_sessions(expires_at);
create index rates_expiry on banglog_plus.rate_limits(expires_at);
do $$ declare t text; begin
 foreach t in array array['members','admin_sessions','admin_audit','rate_limits','analysis_leases','operational_events'] loop
 execute format('alter table banglog_plus.%I enable row level security',t);
 execute format('alter table banglog_plus.%I force row level security',t);
 execute format('revoke all on banglog_plus.%I from public',t);
 execute format('grant select,insert,update,delete on banglog_plus.%I to banglog_plus_admin',t);
 execute format('create policy admin_access on banglog_plus.%I to banglog_plus_admin using(true) with check(true)',t);
 end loop;
 foreach t in array array['usage_daily_summary','answer_daily_summary','legal_sources','legal_source_versions','knowledge_chunks','budget_ledger'] loop
 execute format('grant select on banglog_plus.%I to banglog_plus_admin',t);
 execute format('create policy admin_read on banglog_plus.%I for select to banglog_plus_admin using(true)',t);
 end loop;
 foreach t in array array['rate_limits','analysis_leases','operational_events'] loop
 execute format('grant select,insert,update,delete on banglog_plus.%I to banglog_plus_server',t);
 execute format('create policy service_access on banglog_plus.%I to banglog_plus_server using(true) with check(true)',t);
 end loop;
end $$;
grant usage on sequence banglog_plus.admin_audit_id_seq,banglog_plus.operational_events_id_seq to banglog_plus_admin;
grant usage on sequence banglog_plus.operational_events_id_seq to banglog_plus_server;
grant select,insert,update on banglog_plus.members to banglog_plus_server;
create policy own_member on banglog_plus.members to banglog_plus_server using(user_id=nullif(current_setting('banglog.user_id',true),'')::uuid) with check(user_id=nullif(current_setting('banglog.user_id',true),'')::uuid);
grant select,delete on banglog_plus.member_history to banglog_plus_admin;
create policy admin_history_read on banglog_plus.member_history for select to banglog_plus_admin using(true);
create policy admin_history_delete on banglog_plus.member_history for delete to banglog_plus_admin using(true);
commit;
