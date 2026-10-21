-- Additive category expansion; preserves existing rows, grants and RLS policies.
-- Hosted demo has no database connection. Apply to database environments separately.
alter table banglog_plus.analysis_sessions drop constraint analysis_sessions_issue_check;
alter table banglog_plus.analysis_sessions add constraint analysis_sessions_issue_check
  check (issue in ('mold', 'leak', 'boiler', 'surface', 'drain', 'fixture'));

insert into banglog_plus.legal_source_versions values ('civil-623','2026-03-17.checked-2026-10-21','제623조','2026-10-21','2026-03-17','verified','pending','internal','{"id":"civil-623","version":"2026-03-17.checked-2026-10-21","title":"민법 제623조 · 임대인의 의무","institution":"국가법령정보센터 / 법무부","url":"https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR","location":"제623조","checkedAt":"2026-10-21","effectiveDate":"2026-03-17","technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"주택 사용·수익에 필요한 상태 유지 의무의 일반 원칙. 개별 원인·특약·비용 귀속을 확정하지 않음.","issues":["mold","leak","boiler","surface","drain","fixture"]}');

insert into banglog_plus.legal_source_versions values ('easylaw-repair','checked-2026-10-21','임대인의 의무 / 수선의무','2026-10-21',null,'verified','pending','internal','{"id":"easylaw-repair","version":"checked-2026-10-21","title":"주택임대차 · 임대인의 권리·의무","institution":"찾기쉬운 생활법령정보","url":"https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629&popMenu=ov","location":"임대인의 의무 / 수선의무","checkedAt":"2026-10-21","effectiveDate":null,"technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"수선의무 범위·사용수익 방해·특약 확인을 위한 일반 설명. 사건별 사람 검토 필요.","issues":["mold","leak","boiler","surface","drain","fixture"]}');
