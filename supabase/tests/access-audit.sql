-- Read-only audit after applying migration locally. No remote execution was performed.
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace where n.nspname='banglog_plus' and c.relkind='r' order by 1;
select grantee,table_name,privilege_type from information_schema.role_table_grants
where table_schema='banglog_plus' and grantee in ('PUBLIC','anon','authenticated');
select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='banglog_plus';
select count(*) as public_unreviewed from banglog_plus.legal_source_versions where use_scope='public' and human_legal_review<>'approved';
