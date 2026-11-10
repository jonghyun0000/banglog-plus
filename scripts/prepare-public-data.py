"""Curate downloaded official files. No network, no AI Hub corpus import, no DB write."""
import csv,hashlib,io,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
p=root/'data/research/2026-11-05'
def digest(b):return hashlib.sha256(b).hexdigest()
def encode(d):return json.dumps(d,ensure_ascii=False,sort_keys=True,separators=(',',':'))
registry=[]
uses={
 '15144809':('옵션 가전의 제조사·판매자 수리 분쟁 참고','임대인·임차인의 비용 책임에 직접 적용하지 않음. 현행 기준 및 개별 명제 검토 전 검색 금지.'),
 '15145204':('소비자분쟁 상담 경로와 대상 구분','개인 간 임대차 분쟁과 소비자·사업자 거래를 구분해야 함.'),
 '15134735':('기존 주소 선택의 건축물 용도·구조·사용승인일 맥락','준공연도로 설비 연식·고장 원인·책임을 확정할 수 없음. 개별 건물 원본 일괄 적재 없음.'),
 '15059404':('공식 사건번호·법원·선고일을 확인하는 판례 탐색','목록 API만으로 판결 전문 검증 불가. 본문 서비스 신청과 공식 전문 확인 필요.')}
for id,(purpose,limit) in uses.items():
 raw=(p/f'{id}.catalog.json').read_bytes();c=json.loads(raw)
 assert c['license']['name']=='이용허락범위 제한 없음'
 registry.append(dict(id='data-go-kr-'+id,title=c['name'],provider=c['creator']['name'],catalog_url=c['url'],license_status='confirmed',license_evidence_url=f'https://www.data.go.kr/catalog/{id}/'+('fileData' if id in ['15144809','15145204'] else 'openapi')+'.json',license_evidence_sha256=digest(raw),storage_allowed=True,external_llm_allowed=True,purpose=purpose,limitation=limit,checked_at='2026-11-05T07:00:00Z'))
for id,title,purpose,limit in [
 ('71841','민사법 LLM 사전학습 및 Instruction Tuning 데이터','주택 수리 판례 후보 발굴과 사건 단위 평가 설계','다운로드된 781건 후보는 공식 원문·적용 범위·이용조건 확인 전 로컬만 유지.'),
 ('71834','계약 법률 문서 서식 데이터','수선·원상회복 특약 확인 질문 설계','예시 서식은 사용자 계약이나 판결이 아님. 실제 계약에 자동 적용 금지.'),
 ('162','건물 균열 탐지 이미지','향후 사진에서 구조물 결함 표시 연구 후보','SOC·건물 외벽 위주로 실내 벽지·곰팡이와 도메인 차이. 현재 사진 기능 범위 밖.')]:
 registry.append(dict(id='aihub-'+id,title=title,provider='AI Hub',catalog_url=f'https://www.aihub.or.kr/aihubdata/data/view.do?dataSetSn={id}',license_status='pending',license_evidence_url='https://www.aihub.or.kr/intrcn/guid/usagepolicy.do',license_evidence_sha256=None,storage_allowed=False,external_llm_allowed=False,purpose=purpose,limitation=limit,checked_at='2026-11-05T07:00:00Z'))
selected={'15144809':{'332','333','334','335','336','401','402','403','404','405'},'15145204':{'39','44'}}
candidates=[]
for id,ids in selected.items():
 raw=(p/f'{id}.csv').read_bytes()
 try: text=raw.decode('utf-8-sig')
 except UnicodeDecodeError:text=raw.decode('cp949')
 rows=list(csv.DictReader(io.StringIO(text)))
 found=set()
 for r in rows:
  if r['번호'] not in ids:continue
  found.add(r['번호']);body=encode(r)
  candidates.append(dict(id=f'kca-{id}-row-{r["번호"]}-{digest(body.encode())[:12]}',dataset_id='data-go-kr-'+id,source_row=r['번호'],document_type='official_faq' if id=='15145204' else 'consumer_guidance',title=r['질문'].strip(),payload=r,content_sha256=digest(body.encode()),file_sha256=digest(raw),review_status='pending',review_note='공식 CSV 직접 확보 및 파일·행 해시 기록. 출처 확보는 개별 법률 명제 검증이나 전문가 승인과 다름. 법률·적용 범위 교차검토 전 GPT 검색 제외.'))
 assert found==ids,(id,found)
def quote(x):
 if x is None:return 'null'
 if isinstance(x,bool):return 'true' if x else 'false'
 if isinstance(x,dict):return "'"+encode(x).replace("'","''")+"'::jsonb"
 return "'"+str(x).replace("'","''")+"'"
sql=['begin;']
for table,rows in [('dataset_registry',registry),('evidence_candidates',candidates)]:
 for r in rows:sql.append(f"insert into banglog_plus.{table} ({','.join(r)}) values ({','.join(quote(v) for v in r.values())}) on conflict(id) do nothing;")
sql.append('commit;')
(p/'import.sql').write_text('\n'.join(sql))
(p/'registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2))
(p/'candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2))
(p/'manifest.json').write_text(json.dumps({'checkedAt':'2026-11-05','registryCount':len(registry),'candidateCount':len(candidates),'approvedForRetrieval':0,'aihubCorpusUploaded':False,'selection':'KCA 냉장고·룸에어컨 재수리/손상 10건 + 상담 대상·신청 FAQ 2건','originalFiles':{id:{'rows':1332 if id=='15144809' else 50,'sha256':digest((p/f'{id}.csv').read_bytes())} for id in selected}},ensure_ascii=False,indent=2))
print(json.dumps({'registry':len(registry),'candidates':len(candidates),'approvedForRetrieval':0}))
