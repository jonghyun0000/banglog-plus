begin;
-- Public catalog metadata, not AI Hub corpus text.
create table banglog_plus.dataset_registry (
 id text primary key, title text not null, provider text not null,
 catalog_url text not null check(catalog_url like 'https://%'),
 license_status text not null check(license_status in ('confirmed','pending')),
 license_evidence_url text not null, license_evidence_sha256 text,
 storage_allowed boolean not null default false,
 external_llm_allowed boolean not null default false,
 purpose text not null, limitation text not null, checked_at timestamptz not null,
 check(not external_llm_allowed or (storage_allowed and license_status='confirmed')),
 check(not storage_allowed or license_status='confirmed')
);
create table banglog_plus.evidence_candidates (
 id text primary key, dataset_id text not null references banglog_plus.dataset_registry(id),
 source_row text not null, document_type text not null check(document_type in ('official_faq','consumer_guidance','judgment','contract_example')),
 title text not null, payload jsonb not null, content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
 file_sha256 text not null check(file_sha256 ~ '^[a-f0-9]{64}$'),
 review_status text not null default 'pending' check(review_status in ('pending','rejected','approved')),
 review_note text not null, created_at timestamptz not null default now(),
 unique(dataset_id,source_row,content_sha256)
);
create index evidence_dataset on banglog_plus.evidence_candidates(dataset_id);
-- Permission is checked independently of immutable legal source versions.
-- Missing, expired or revoked permission fails closed in public retrieval.
create table banglog_plus.source_permissions (
 source_id text not null, source_version text not null,
 external_llm_allowed boolean not null default false,
 permission_evidence_url text not null check(permission_evidence_url like 'https://%'),
 reviewed_by text not null check(length(reviewed_by)>0),
 checked_at timestamptz not null, expires_at timestamptz not null,
 revoked_at timestamptz,
 primary key(source_id,source_version),
 foreign key(source_id,source_version) references banglog_plus.legal_source_versions(source_id,version),
 check(expires_at>checked_at)
);
create function banglog_plus.check_candidate_storage() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from banglog_plus.dataset_registry where id=new.dataset_id and storage_allowed and license_status='confirmed') then
  raise exception 'DATASET_STORAGE_NOT_ALLOWED';
 end if;
 return new;
end $$;
revoke all on function banglog_plus.check_candidate_storage() from public;
create trigger candidate_storage_gate before insert or update on banglog_plus.evidence_candidates for each row execute function banglog_plus.check_candidate_storage();
do $$ declare t text; begin
 foreach t in array array['dataset_registry','evidence_candidates','source_permissions'] loop
 execute format('alter table banglog_plus.%I enable row level security',t);
 execute format('alter table banglog_plus.%I force row level security',t);
 execute format('revoke all on banglog_plus.%I from public',t);
 execute format('grant select on banglog_plus.%I to banglog_plus_admin',t);
 execute format('create policy admin_read on banglog_plus.%I for select to banglog_plus_admin using(true)',t);
 end loop;
end $$;
grant select on banglog_plus.source_permissions to banglog_plus_server;
create policy permission_read on banglog_plus.source_permissions for select to banglog_plus_server using(true);
commit;
