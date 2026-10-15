-- Private PostgreSQL schema; do not add to Supabase exposed schemas.
begin;
create schema banglog_plus;
revoke all on schema banglog_plus from public;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='banglog_plus_server') then
  create role banglog_plus_server nologin nosuperuser nobypassrls;
 end if;
end $$;
grant usage on schema banglog_plus to banglog_plus_server;
create table banglog_plus.guest_sessions (
 id uuid primary key, token_hash text not null unique check(length(token_hash)=64),
 expires_at timestamptz not null, revoked_at timestamptz,
 consent_version text not null, created_at timestamptz not null default now()
);
create index guest_expiry on banglog_plus.guest_sessions(expires_at);
create table banglog_plus.analysis_sessions (
 id uuid primary key, guest_id uuid not null references banglog_plus.guest_sessions(id) on delete cascade,
 issue text not null check(issue in ('mold','leak','boiler')), audience text not null default 'tenant' check(audience='tenant'),
 input_version integer not null check(input_version>0), idempotency_key uuid not null, input_digest text not null,
 input jsonb not null, state text not null check(state in ('pending','complete','cancelled','failed')),
 failure_code text, created_at timestamptz not null default now(),
 unique(guest_id,idempotency_key),unique(guest_id,input_version),unique(id,guest_id)
);
create table banglog_plus.case_facts (
 analysis_id uuid not null, guest_id uuid not null, facts jsonb not null,
 primary key(analysis_id),foreign key(analysis_id,guest_id) references banglog_plus.analysis_sessions(id,guest_id) on delete cascade
);
create table banglog_plus.question_answers (
 analysis_id uuid not null, guest_id uuid not null, question_version text not null, answers jsonb not null,
 primary key(analysis_id),foreign key(analysis_id,guest_id) references banglog_plus.analysis_sessions(id,guest_id) on delete cascade
);
create table banglog_plus.legal_sources (id text primary key, title text not null, institution text not null, url text not null check(url like 'https://%'));
create table banglog_plus.legal_source_versions (
 source_id text not null references banglog_plus.legal_sources(id), version text not null,
 location text not null, checked_at date not null, effective_date date,
 technical_status text not null check(technical_status in ('verified','pending')),
 human_legal_review text not null check(human_legal_review in ('pending','approved')),
 use_scope text not null check(use_scope in ('internal','public')), metadata jsonb not null,
 primary key(source_id,version),check(use_scope!='public' or human_legal_review='approved')
);
create table banglog_plus.analysis_results (
 analysis_id uuid primary key,guest_id uuid not null,input_version integer not null,
 result jsonb not null,rule_version text not null,prompt_version text not null,model text not null,
 foreign key(analysis_id,guest_id) references banglog_plus.analysis_sessions(id,guest_id) on delete cascade,
 unique(analysis_id,guest_id)
);
create table banglog_plus.result_sources (
 analysis_id uuid not null,guest_id uuid not null,source_id text not null,source_version text not null,claim text not null,location text not null,
 primary key(analysis_id,source_id,source_version),
 foreign key(analysis_id,guest_id) references banglog_plus.analysis_results(analysis_id,guest_id) on delete cascade,
 foreign key(source_id,source_version) references banglog_plus.legal_source_versions(source_id,version)
);
create table banglog_plus.feedback_events (
 analysis_id uuid primary key, guest_id uuid not null,
 helpful text not null check(helpful in ('yes','no','unsure')), understood text not null check(understood in ('yes','no','unsure')),
 error_type text not null check(error_type in ('none','fact','source','responsibility','wording','other')),
 foreign key(analysis_id,guest_id) references banglog_plus.analysis_results(analysis_id,guest_id) on delete cascade
);
create table banglog_plus.usage_metrics (
 id uuid primary key,guest_id uuid not null references banglog_plus.guest_sessions(id) on delete cascade,
 analysis_id uuid,event text not null check(event in ('start','questions_complete','analysis_success','copy_success','feedback')),
 mode text not null check(mode in ('mock','live')),data jsonb not null,created_at timestamptz not null default now(),
 foreign key(analysis_id,guest_id) references banglog_plus.analysis_sessions(id,guest_id) on delete cascade
);
create unique index metric_once on banglog_plus.usage_metrics(guest_id,coalesce(analysis_id,'00000000-0000-0000-0000-000000000000'::uuid),event);
create table banglog_plus.budget_ledger(day date primary key,calls bigint not null check(calls>=0),tokens bigint not null check(tokens>=0),usd numeric not null check(usd>=0));
-- No anonymous/authenticated grants, no auth.uid assumption, no SECURITY DEFINER.
do $$ declare t text; begin
 foreach t in array array['guest_sessions','analysis_sessions','case_facts','question_answers','legal_sources','legal_source_versions','analysis_results','result_sources','feedback_events','usage_metrics','budget_ledger'] loop
  execute format('alter table banglog_plus.%I enable row level security',t);
  execute format('alter table banglog_plus.%I force row level security',t);
 end loop;
 foreach t in array array['analysis_sessions','case_facts','question_answers','analysis_results','result_sources','feedback_events','usage_metrics'] loop
  execute format('create policy owner_only on banglog_plus.%I to banglog_plus_server using (guest_id = nullif(current_setting(''banglog.guest_id'',true),'''')::uuid) with check (guest_id = nullif(current_setting(''banglog.guest_id'',true),'''')::uuid)',t);
  execute format('grant select,insert,update,delete on banglog_plus.%I to banglog_plus_server',t);
  execute format('create index on banglog_plus.%I(guest_id)',t);
 end loop;
end $$;
create policy guest_owner on banglog_plus.guest_sessions to banglog_plus_server
 using (id=nullif(current_setting('banglog.guest_id',true),'')::uuid or token_hash=nullif(current_setting('banglog.token_hash',true),'') or expires_at<=now() or revoked_at is not null)
 with check (id=nullif(current_setting('banglog.guest_id',true),'')::uuid);
grant select,insert,update,delete on banglog_plus.guest_sessions to banglog_plus_server;
create policy source_read on banglog_plus.legal_sources for select to banglog_plus_server using (nullif(current_setting('banglog.guest_id',true),'') is not null);
create policy source_version_read on banglog_plus.legal_source_versions for select to banglog_plus_server using (nullif(current_setting('banglog.guest_id',true),'') is not null);
grant select on banglog_plus.legal_sources,banglog_plus.legal_source_versions to banglog_plus_server;
create policy budget_server on banglog_plus.budget_ledger to banglog_plus_server using (day=current_date) with check (day=current_date);
grant select,insert,update on banglog_plus.budget_ledger to banglog_plus_server;
-- Version rows are immutable, including privileged accidental edits.
create function banglog_plus.reject_source_change() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'source versions are immutable; insert a new version'; end $$;
revoke all on function banglog_plus.reject_source_change() from public;
create trigger immutable_source_version before update or delete on banglog_plus.legal_source_versions for each row execute function banglog_plus.reject_source_change();
commit;

begin;
insert into banglog_plus.legal_sources values ('civil-623','민법 제623조 · 임대인의 의무','국가법령정보센터 / 법무부','https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR');
insert into banglog_plus.legal_source_versions values ('civil-623','2026-03-17.checked-2026-10-15','제623조','2026-10-15','2026-03-17','verified','pending','internal','{"id":"civil-623","version":"2026-03-17.checked-2026-10-15","title":"민법 제623조 · 임대인의 의무","institution":"국가법령정보센터 / 법무부","url":"https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR","location":"제623조","checkedAt":"2026-10-15","effectiveDate":"2026-03-17","technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"주택 사용·수익에 필요한 상태 유지 의무의 일반 원칙. 개별 원인·특약·비용 귀속을 확정하지 않음.","issues":["mold","leak","boiler"]}');
insert into banglog_plus.legal_sources values ('easylaw-repair','주택임대차 · 임대인의 권리·의무','찾기쉬운 생활법령정보','https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629&popMenu=ov');
insert into banglog_plus.legal_source_versions values ('easylaw-repair','checked-2026-10-15','임대인의 의무 / 수선의무','2026-10-15',null,'verified','pending','internal','{"id":"easylaw-repair","version":"checked-2026-10-15","title":"주택임대차 · 임대인의 권리·의무","institution":"찾기쉬운 생활법령정보","url":"https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629&popMenu=ov","location":"임대인의 의무 / 수선의무","checkedAt":"2026-10-15","effectiveDate":null,"technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"수선의무 범위·사용수익 방해·특약 확인을 위한 일반 설명. 사건별 사람 검토 필요.","issues":["mold","leak","boiler"]}');
commit;
