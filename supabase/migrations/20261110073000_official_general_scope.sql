-- Separate bounded statutory guidance from expert-reviewed public case conclusions.
-- Existing public => human approved constraint, RLS, roles and immutable rows remain unchanged.
alter table banglog_plus.legal_source_versions drop constraint legal_source_versions_use_scope_check;
alter table banglog_plus.legal_source_versions add constraint legal_source_versions_use_scope_check check(use_scope in ('internal','public','general'));
alter table banglog_plus.legal_source_versions add constraint official_general_scope_check check(
 use_scope <> 'general' or (
   technical_status='verified' and human_legal_review='pending'
   and coalesce(metadata->>'reviewBasis','')='official_statute'
   and coalesce(metadata->>'use','')='general'
   and coalesce(metadata->'reviewEvidence'->>'reviewerType','')='ai_source_comparison'
   and coalesce(metadata->'reviewEvidence'->>'originalSha256','') ~ '^[a-f0-9]{64}$'
 ));
