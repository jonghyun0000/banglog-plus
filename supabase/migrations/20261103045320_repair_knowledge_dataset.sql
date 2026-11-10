-- Internal curated repair knowledge. No raw user records, external scraping or remote changes.
begin;
create table banglog_plus.knowledge_chunks (
 id text not null, dataset_version text not null,
 source_id text not null, source_version text not null,
 claim_id text not null, claim text not null check(length(claim) between 1 and 800),
 content text not null check(length(content) between 1 and 2400),
 issues text[] not null check(cardinality(issues)>0 and issues <@ array['mold','leak','boiler','surface','drain','fixture']::text[]),
 keywords text[] not null, observations text[] not null,
 primary key(id,dataset_version), unique(dataset_version,claim_id),
 foreign key(source_id,source_version) references banglog_plus.legal_source_versions(source_id,version)
);
create index knowledge_dataset on banglog_plus.knowledge_chunks(dataset_version);
create index knowledge_source_version on banglog_plus.knowledge_chunks(source_id,source_version);
create index knowledge_issues on banglog_plus.knowledge_chunks using gin(issues);
alter table banglog_plus.knowledge_chunks enable row level security;
alter table banglog_plus.knowledge_chunks force row level security;
revoke all on banglog_plus.knowledge_chunks from public;
grant select on banglog_plus.knowledge_chunks to banglog_plus_server;
create policy knowledge_server_read on banglog_plus.knowledge_chunks for select to banglog_plus_server
 using (nullif(current_setting('banglog.guest_id',true),'') is not null);
create trigger immutable_knowledge_chunk before update or delete on banglog_plus.knowledge_chunks
 for each row execute function banglog_plus.reject_source_change();
insert into banglog_plus.legal_sources(id,title,institution,url) values('civil-623','민법 제623조 · 임대인의 의무','국가법령정보센터 / 법무부','https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR') on conflict do nothing;
insert into banglog_plus.legal_source_versions values('civil-623','2026-03-17.checked-2026-10-21','제623조','2026-10-21','2026-03-17','verified','pending','internal','{"id":"civil-623","version":"2026-03-17.checked-2026-10-21","title":"민법 제623조 · 임대인의 의무","institution":"국가법령정보센터 / 법무부","url":"https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0623&lsiSeq=284415&urlMode=lsScJoRltInfoR","location":"제623조","checkedAt":"2026-10-21","effectiveDate":"2026-03-17","technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"주택 사용·수익에 필요한 상태 유지 의무의 일반 원칙. 개별 원인·특약·비용 귀속을 확정하지 않음.","issues":["mold","leak","boiler","surface","drain","fixture"]}') on conflict do nothing;
insert into banglog_plus.legal_sources(id,title,institution,url) values('easylaw-repair','주택임대차 · 임대인의 권리·의무','찾기쉬운 생활법령정보','https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629&popMenu=ov') on conflict do nothing;
insert into banglog_plus.legal_source_versions values('easylaw-repair','checked-2026-10-21','임대인의 의무 / 수선의무','2026-10-21',null,'verified','pending','internal','{"id":"easylaw-repair","version":"checked-2026-10-21","title":"주택임대차 · 임대인의 권리·의무","institution":"찾기쉬운 생활법령정보","url":"https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=2&cnpClsNo=2&csmSeq=629&popMenu=ov","location":"임대인의 의무 / 수선의무","checkedAt":"2026-10-21","effectiveDate":null,"technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"수선의무 범위·사용수익 방해·특약 확인을 위한 일반 설명. 사건별 사람 검토 필요.","issues":["mold","leak","boiler","surface","drain","fixture"]}') on conflict do nothing;
insert into banglog_plus.legal_sources(id,title,institution,url) values('2023da249661','대법원 2023다249661 · 원상회복 범위','대법원 / 국가법령정보센터','https://www.law.go.kr/LSW/precInfoP.do?precSeq=237925') on conflict do nothing;
insert into banglog_plus.legal_source_versions values('2023da249661','checked-2026-11-03','판시사항·판결요지','2026-11-03',null,'verified','pending','internal','{"id":"2023da249661","version":"checked-2026-11-03","title":"대법원 2023다249661 · 원상회복 범위","institution":"대법원 / 국가법령정보센터","url":"https://www.law.go.kr/LSW/precInfoP.do?precSeq=237925","location":"판시사항·판결요지","checkedAt":"2026-11-03","effectiveDate":null,"technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"토지·시설물 사건으로, 주택 벽지·장판의 마모나 교체비를 직접 판단한 사건은 아니에요.","issues":["surface"]}') on conflict do nothing;
insert into banglog_plus.legal_sources(id,title,institution,url) values('2018da291347','대법원 2018다291347 · 임대 장비의 훼손','대법원 / 국가법령정보센터','https://www.law.go.kr/LSW/precInfoP.do?precSeq=207102') on conflict do nothing;
insert into banglog_plus.legal_source_versions values('2018da291347','checked-2026-11-03','판시사항·판결요지','2026-11-03',null,'verified','pending','internal','{"id":"2018da291347","version":"checked-2026-11-03","title":"대법원 2018다291347 · 임대 장비의 훼손","institution":"대법원 / 국가법령정보센터","url":"https://www.law.go.kr/LSW/precInfoP.do?precSeq=207102","location":"판시사항·판결요지","checkedAt":"2026-11-03","effectiveDate":null,"technicalStatus":"verified","humanLegalReview":"pending","use":"internal","scope":"주택 옵션 가전 사건은 아니에요. 수선의무와 훼손에 대한 배상책임을 구분해야 하며, 고장 원인이 불명확하다는 이유만으로 임차인이 면책되는 것도 아니에요.","issues":["fixture","boiler"]}') on conflict do nothing;
insert into banglog_plus.knowledge_chunks values('maintenance-principle','repair-kb-2026-11-03.v1','civil-623','2026-03-17.checked-2026-10-21','maintenance','임대인은 계약 기간 동안 주택을 사용·수익하는 데 필요한 상태를 유지할 의무가 있다는 일반 원칙이 있어요.','임대인이 목적물을 사용·수익에 필요한 상태로 유지할 의무가 있다는 일반 원칙을 다룬 조문 요약입니다. 고장 원인이나 모든 수리비의 귀속을 이 조문만으로 확정하지 않습니다.',array['mold','leak','boiler','surface','drain','fixture']::text[],array['수리','고장','누수','곰팡이','보일러','배수']::text[],array[]::text[]);
insert into banglog_plus.knowledge_chunks values('repair-scope','repair-kb-2026-11-03.v1','easylaw-repair','checked-2026-10-21','scope','수선의무 범위는 사용에 미치는 영향과 수리의 정도, 계약 조건 등을 함께 확인해야 해요.','공식 생활법령의 수선의무 설명을 정리한 자료입니다. 사용·수익에 미치는 영향, 수리 정도, 계약 문구와 실제 원인을 함께 확인합니다. 세입자 설명과 전달받은 점검 의견을 검증된 원인으로 바꾸지 않습니다.',array['mold','leak','boiler','surface','drain','fixture']::text[],array['계약','특약','점검','노후','원인','수선']::text[],array[]::text[]);
insert into banglog_plus.knowledge_chunks values('initial-state-restoration','repair-kb-2026-11-03.v1','2023da249661','checked-2026-11-03','initial-state','입주 당시 상태와 원상회복 약정을 확인할 필요가 있어요. 참고 판결은 이전 임차인의 시설이 있던 토지 사건으로, 주택 벽지·장판 비용을 직접 정한 판결은 아니에요.','2023다249661은 토지 임대 당시 이미 있던 종전 임차인의 시설 철거가 쟁점입니다. 임차 당시 상태로 반환하는 것이 원칙이나 계약 체결 경위와 내용 등 특별한 사정을 개별적으로 판단합니다. 통상 마모 금액이나 벽지 교체비 비율을 정한 판결은 아닙니다.',array['surface']::text[],array['벽지','장판','찍힘','찢어','원상회복','입주']::text[],array['wall-tear','wall-dent','floor-tear','floor-dent']::text[]);
insert into banglog_plus.knowledge_chunks values('equipment-cause-and-control','repair-kb-2026-11-03.v1','2018da291347','checked-2026-11-03','equipment-cause','제품 고장의 원인과 관리 영역을 확인해야 해요. 참고 판결은 임대 장비 반환 시 훼손 사건으로, 임대인의 수선의무만으로 최종 손해배상책임을 정하지 않아요.','2018다291347은 임대 장비의 반환 시 훼손과 손해배상 사건입니다. 임차인이 책임질 수 없는 사유의 증명 및 임대인의 지배·관리 영역에 있는 하자 여부를 심리해야 한다는 취지입니다. 원인 불명만으로 임차인이 면책되는 것은 아니며 주택 옵션 가전의 직접 사건도 아닙니다.',array['fixture','boiler']::text[],array['냉장고','세탁기','에어컨','보일러','옵션','노후','과실']::text[],array[]::text[]);
commit;
