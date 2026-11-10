import type { DataGovernance } from "../../../shared/admin.js";
import { releaseLabel } from "../../../shared/release";
import { useEffect, useState } from "react";
import type {
  Dashboard,
  KnowledgeRow,
  MemberRow,
  AuditRow,
} from "../../../shared/admin";
import { issueNames } from "../../../shared/schema";
import { answerLabel, options, observations } from "../../../shared/questions";
import { Status } from "../status/Status";
import "./admin.css";
const labels: Record<string, string> = {
  observation: "보이는 증상",
  discovered: "발견 시점",
  preexisting: "입주 당시 상태",
  installed: "설치 주체",
  cause: "원인 설명",
  causeSource: "설명 출처",
  otherClaim: "다른 주장",
  contact: "연락 상태",
  safety: "위험 신호",
};
const actions: Record<string, string> = {
  login: "관리자 로그인",
  logout: "로그아웃",
  block: "회원 기록 이용 제한",
  unblock: "이용 제한 해제",
  delete_history: "회원 기록 삭제",
  cleanup: "보관기간 정리",
  gpt_generation_check: "GPT 실제 응답 검사",
  gpt_auth_check: "GPT 인증 검사",
};
async function request<T>(path: string, body?: object): Promise<T> {
  const r = await fetch("/api/admin/" + path, {
    method: body ? "POST" : "GET",
    headers: body
      ? { "Content-Type": "application/json", "X-Admin-Request": "1" }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!r.ok) {
    const e = await r
      .json()
      .catch(() => ({ message: "서버 연결을 확인해 주세요." }));
    throw new Error(e.message ?? "요청을 처리하지 못했어요.");
  }
  return r.json();
}
export default function Admin() {
  const [governance, setGovernance] = useState<DataGovernance | null>(null);
  const [governanceError, setGovernanceError] = useState("");
  const [authorized, setAuthorized] = useState(false),
    [checking, setChecking] = useState(true),
    [password, setPassword] = useState(""),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [days, setDays] = useState(30),
    [data, setData] = useState<Dashboard | null>(null),
    [knowledge, setKnowledge] = useState<KnowledgeRow[]>([]),
    [members, setMembers] = useState<MemberRow[]>([]),
    [total, setTotal] = useState(0),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [audit, setAudit] = useState<AuditRow[]>([]),
    [filter, setFilter] = useState(""),
    [target, setTarget] = useState<{ id: string; action: string } | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (!authorized) return;
    let alive = true;
    request<DataGovernance>("data-governance")
      .then((g) => {
        if (alive) setGovernance(g);
      })
      .catch(() => {
        if (alive) setGovernanceError("자료 검토 현황을 불러오지 못했습니다.");
      });
    return () => {
      alive = false;
    };
  }, [authorized]);
  useEffect(() => {
    request("session")
      .then(() => setAuthorized(true))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    if (!authorized) return;
    let alive = true;
    Promise.all([
      request<Dashboard>("dashboard?days=" + days),
      request<KnowledgeRow[]>("knowledge"),
      request<AuditRow[]>("audit"),
    ])
      .then(([d, k, a]) => {
        if (alive) {
          setData(d);
          setKnowledge(k);
          setAudit(a);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [authorized, days, notice]);
  useEffect(() => {
    if (!authorized) return;
    let alive = true;
    const timer = setTimeout(() => {
      request<{ items: MemberRow[]; total: number }>(
        "members?search=" + encodeURIComponent(search) + "&page=" + page,
      )
        .then((r) => {
          if (alive) {
            setMembers(r.items);
            setTotal(r.total);
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [authorized, search, page, notice]);
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }
  const completed = data?.usage.reduce((n, r) => n + r.count, 0) ?? 0;
  if (checking)
    return (
      <main className="admin-login">
        <p>관리자 접근 권한을 확인하고 있어요.</p>
      </main>
    );
  if (!authorized)
    return (
      <main className="admin-login">
        <a href="/" className="admin-brand">
          <img src="/logo.svg" alt="" />
          방로그 Plus
        </a>
        <p className="eyebrow">운영자 전용 · {releaseLabel}</p>
        <h1>관리자 로그인</h1>
        <p>
          <a href="/admin">로그인 없이 공개 관리자 화면 보기 →</a>
        </p>
        <p>서비스 현황, 검증 자료와 회원 기록을 관리합니다.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void perform(async () => {
              await request("login", { password });
              setPassword("");
              setAuthorized(true);
            });
          }}
        >
          <label>
            관리자 비밀번호
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              maxLength={128}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>
            {busy ? "확인 중…" : "관리자 로그인"}
          </button>
        </form>
        <p className="small">
          관리자 전용 접근입니다. 로그인은 8시간 후 만료됩니다.
        </p>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <img src="/logo.svg" alt="" />
          방로그 Plus
        </a>
        <p className="admin-version">{releaseLabel} · 운영 관리</p>
        <nav aria-label="관리자 메뉴">
          {[
            ["overview", "운영 현황"],
            ["answers", "사용자 답변"],
            ["knowledge", "판례·근거 자료"],
            ["members", "회원 관리"],
            ["status", "연결·운영 점검"],
            ["audit", "관리 이력"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                setTab(id);
                setFilter("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <a href="/" className="text-button">
          서비스로 돌아가기 ↗
        </a>
        <button
          className="text-button"
          onClick={() =>
            void perform(async () => {
              await request("logout", {});
              setAuthorized(false);
              setData(null);
              setMembers([]);
              setKnowledge([]);
              setAudit([]);
            })
          }
        >
          로그아웃
        </button>
      </aside>
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="eyebrow">BANGLOG PLUS / CONSOLE</p>
            <h1>
              {
                {
                  overview: "운영 현황",
                  answers: "사용자 답변",
                  knowledge: "판례·근거 자료",
                  members: "회원 관리",
                  status: "연결·운영 점검",
                  audit: "관리 이력",
                }[tab]
              }
            </h1>
          </div>
          <label>
            조회 기간
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>최근 7일</option>
              <option value={30}>최근 30일</option>
              <option value={90}>최근 90일</option>
            </select>
          </label>
        </header>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        {tab === "overview" && (
          <>
            <div className="admin-metrics">
              {[
                ["분석 완료", completed.toLocaleString() + "건"],
                ["등록 회원", (data?.members.total ?? 0) + "명"],
                ["이용 제한", (data?.members.blocked ?? 0) + "명"],
                ["검색 근거", knowledge.length + "개"],
              ].map(([k, v]) => (
                <article key={k}>
                  <p>{k}</p>
                  <strong>{v}</strong>
                </article>
              ))}
            </div>
            <p className="small">
              분석 완료는 사람 수가 아닌 결과 생성 건수입니다. 회원 수·근거 수는
              현재 전체 기준입니다.
            </p>
            <section className="admin-card">
              <h2>문제 유형별 이용</h2>
              {Object.entries(issueNames).map(([id, name]) => {
                const count =
                  data?.usage
                    .filter((r) => r.issue === id)
                    .reduce((n, r) => n + r.count, 0) ?? 0;
                return (
                  <div className="admin-bar" key={id}>
                    <span>{name}</span>
                    <progress value={count} max={Math.max(completed, 1)} />
                    <b>{count}건</b>
                  </div>
                );
              })}
              {!completed && (
                <p>
                  아직 수집된 이용 결과가 없어요. 운영 후 실제 데이터가
                  표시됩니다.
                </p>
              )}
            </section>
            <section className="admin-card">
              <h2>AI 응답과 기본 안내</h2>
              {data?.operations.length ? (
                <div className="admin-table">
                  <table>
                    <thead>
                      <tr>
                        <th>처리 유형</th>
                        <th>사유</th>
                        <th>건수</th>
                        <th>평균 응답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.operations.map((r) => (
                        <tr key={r.kind + String(r.code)}>
                          <td>
                            {{
                              ai_success: "GPT 답변",
                              fallback: "기본 안내 전환",
                              rule_result: "안전·범위 안내",
                              probe_success: "운영 검사 성공",
                              probe_failure: "운영 검사 실패",
                            }[r.kind] ?? r.kind}
                          </td>
                          <td>{r.code ?? "—"}</td>
                          <td>{r.count}</td>
                          <td>
                            {r.latency === null
                              ? "—"
                              : (r.latency / 1000).toFixed(1) + "초"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>운영 기록이 아직 없습니다.</p>
              )}
              <p className="small">
                운영 기록은 30일 보관합니다. 검사용 호출은 사용자 분석 통계와
                분리됩니다.
              </p>
            </section>
          </>
        )}
        {tab === "answers" && (
          <section className="admin-card">
            <h2>질문별 선택 분포</h2>
            <p>자유 입력 원문·개인 식별정보 없이 선택 답변을 집계합니다.</p>
            <label>
              문제 유형
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">전체 유형</option>
                {Object.entries(issueNames).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>질문</th>
                    <th>답변</th>
                    <th>선택 수</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.answers
                    .filter((r) => !filter || r.issue === filter)
                    .map((r) => (
                      <tr key={[r.issue, r.question, r.answer].join("/")}>
                        <td>{issueNames[r.issue]}</td>
                        <td>{labels[r.question] ?? r.question}</td>
                        <td>
                          {r.question === "observation"
                            ? (observations[r.issue].find(
                                (v) => v[0] === r.answer,
                              )?.[1] ?? r.answer)
                            : r.question in options
                              ? answerLabel(
                                  r.question as keyof typeof options,
                                  r.answer,
                                )
                              : r.answer}
                        </td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!data?.answers.length && (
              <p>아직 선택 답변이 집계되지 않았습니다.</p>
            )}
          </section>
        )}
        {tab === "knowledge" && (
          <>
            <section className="admin-card">
              <h2>데이터 검토와 GPT 사용 상태</h2>
              {governanceError && <p role="status">{governanceError}</p>}
              {governance && (
                <>
                  <p>
                    등록 자료 {governance.datasets.length}종 · 검토 후보{" "}
                    {governance.candidates.reduce((sum, r) => sum + r.count, 0)}
                    건 · 전문가 검토 승인{" "}
                    {governance.eligibility.public_eligible}개 · 공식 조문 일반
                    안내 {governance.eligibility.official_general ?? 0}개
                  </p>
                  <p>
                    판례는 전문가 검토와 이용조건 확인 후 사용합니다. 공식
                    조문은 별도 원문 대조와 이용조건 확인을 거친 제한적 일반
                    안내에만 사용합니다.
                  </p>
                  {governance.datasets.map((d) => (
                    <details key={d.id}>
                      <summary>
                        {d.title} ·{" "}
                        {d.storage_allowed ? "저장 가능" : "원문 저장 보류"}
                      </summary>
                      <p>{d.purpose}</p>
                      <p>{d.limitation}</p>
                      <p>
                        이용조건{" "}
                        {d.license_status === "confirmed"
                          ? "확인"
                          : "확인 대기"}{" "}
                        · 외부 AI 이용조건{" "}
                        {d.external_llm_allowed
                          ? "확인 (개별 근거 검토 별도)"
                          : "확인 대기"}
                      </p>
                      <a href={d.catalog_url} target="_blank" rel="noreferrer">
                        제공기관 자료 확인 ↗
                      </a>
                    </details>
                  ))}
                </>
              )}
              <h2>출처 대조를 마친 자료</h2>
              <p>
                판례 원문 대조와 법률가 검토는 별개입니다. 현재 자료는 법률가
                검토 대기 상태이며, 개별 사건의 책임을 확정하지 않습니다.
              </p>
              <label>
                자료 검색
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="사건번호, 제목, 요약 검색"
                />
              </label>
            </section>
            {knowledge
              .filter((k) => (k.source.title + k.content).includes(filter))
              .map((k) => (
                <article key={k.id} className="admin-card">
                  <p className="eyebrow">
                    {k.issues.map((i) => issueNames[i]).join(" · ")}
                  </p>
                  <h2>{k.source.title}</h2>
                  <p>{k.content}</p>
                  <p className="notice">적용 한계: {k.source.scope}</p>
                  <p className="small">
                    출처 확인 {k.source.checkedAt} · 법률가 검토{" "}
                    {k.source.humanLegalReview === "approved" ? "완료" : "대기"}
                  </p>
                  <a href={k.source.url} target="_blank" rel="noreferrer">
                    공식 원문 ↗
                  </a>
                  {k.source.verification && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={k.source.verification.crossCheckUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        대조 자료 ↗
                      </a>
                      <details>
                        <summary>대조 기록</summary>
                        <p>{k.source.verification.method}</p>
                        <p>{k.source.verification.limitations}</p>
                      </details>
                    </>
                  )}
                </article>
              ))}
          </>
        )}
        {tab === "members" && (
          <section className="admin-card">
            <h2>방로그 Plus 회원 · {total}명</h2>
            <p>
              방로그에서 로그인해 기록 기능을 이용한 회원만 표시합니다. 이용
              제한은 Plus 회원 기록 기능에만 적용하며 다른 서비스 계정에는
              영향을 주지 않습니다.
            </p>
            <label>
              이메일·회원 ID 검색
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>상태</th>
                    <th>보관 기록</th>
                    <th>최근 이용</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id}>
                      <td>
                        {m.email ?? "이메일 미제공"}
                        <small>{m.user_id}</small>
                        <small>{m.provider ?? "로그인 제공자 미확인"}</small>
                      </td>
                      <td>{m.status === "active" ? "정상" : "이용 제한"}</td>
                      <td>{m.history_count}건</td>
                      <td>
                        {new Date(m.last_seen_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            setTarget({
                              id: m.user_id,
                              action:
                                m.status === "active" ? "block" : "unblock",
                            });
                            setReason("");
                          }}
                        >
                          {m.status === "active" ? "제한" : "제한 해제"}
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setTarget({
                              id: m.user_id,
                              action: "delete_history",
                            });
                            setReason("");
                          }}
                        >
                          기록 삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!members.length && (
              <p>
                조회된 회원이 없습니다. 로그인 제공자 설정은 연결 점검에서
                확인할 수 있습니다.
              </p>
            )}
            <div className="admin-actions">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                이전
              </button>
              <span>{page}페이지</span>
              <button
                disabled={page * 30 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </button>
            </div>
            {target && (
              <form
                className="admin-confirm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void perform(async () => {
                    await request("members/" + target.id, {
                      action: target.action,
                      reason,
                      confirm: true,
                    });
                    setTarget(null);
                    setNotice(
                      "회원 관리 작업을 완료하고 이력에 기록했습니다. " +
                        new Date().toLocaleTimeString(),
                    );
                  });
                }}
              >
                <h3>{actions[target.action]} 확인</h3>
                <p>
                  {target.action === "delete_history"
                    ? "이 회원의 방로그 저장 기록을 삭제합니다. 복구할 수 없습니다. 로그인 계정과 익명 집계는 유지됩니다."
                    : "방로그 Plus의 회원 기록 이용 상태를 변경합니다."}
                </p>
                <label>
                  처리 사유
                  <input
                    required
                    minLength={3}
                    maxLength={200}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  확인 후 실행
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setTarget(null)}
                >
                  취소
                </button>
              </form>
            )}
          </section>
        )}
        {tab === "status" && (
          <>
            <Status expanded />
            <section className="admin-card">
              <h2>GPT 연결 검사</h2>
              <p>
                인증 검사는 모델 접근 권한을 확인합니다. 실제 응답 검사는 합성
                사례와 DB 근거로 GPT를 1회 호출하며 API 사용량이 발생합니다.
              </p>
              <div className="admin-actions">
                {[false, true].map((generate) => (
                  <button
                    className="button secondary"
                    key={String(generate)}
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        const r = await request<{
                          kind: string;
                          model: string;
                          latencyMs: number;
                          sources?: number;
                        }>("check", { generate });
                        setNotice(
                          (generate ? "실제 응답" : "인증") +
                            " 검사 성공 · " +
                            r.model +
                            " · " +
                            (r.latencyMs / 1000).toFixed(1) +
                            "초" +
                            (r.sources !== undefined
                              ? " · 근거 " + r.sources + "건"
                              : ""),
                        );
                      })
                    }
                  >
                    {generate ? "GPT 실제 응답 검사" : "API 인증 검사"}
                  </button>
                ))}
              </div>
              <p>
                일일 호출 상한 {data?.limits.calls}회 · 토큰 예약 상한{" "}
                {data?.limits.tokens.toLocaleString()}
              </p>
              <p className="small">
                오늘 호출 예약{" "}
                {data?.budget.find(
                  (b) =>
                    b.day ===
                    new Intl.DateTimeFormat("sv-SE", {
                      timeZone: "Asia/Seoul",
                    }).format(new Date()),
                )?.calls ?? 0}
                회. 제공자 청구액과 예약량은 다를 수 있습니다.
              </p>
            </section>
            <section className="admin-card">
              <h2>현도컴퍼니 회원 연결</h2>
              <p>
                이메일·비밀번호 로그인:{" "}
                {data?.status.login.email ? "사용 설정됨" : "설정 필요"}
              </p>
              <p className="small">
                동일한 현도컴퍼니 계정을 사용하며 방로그 기록과 권한은
                분리합니다. 신규 가입은 이메일과 비밀번호로 진행하며 가입
                화면에서 비밀번호를 한 번 더 확인합니다.
              </p>
            </section>
            <section className="admin-card">
              <h2>보관기간 관리</h2>
              <p>
                비회원 기록 24시간, 회원 저장 기록 90일, 운영 기록 30일, 관리자
                변경 이력 180일. 선택 답변 집계는 식별정보 없이 유지합니다.
              </p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await request("cleanup", {});
                    setNotice(
                      "보관기간이 지난 기록을 정리했습니다. " +
                        new Date().toLocaleTimeString(),
                    );
                  })
                }
              >
                만료 기록 정리
              </button>
            </section>
          </>
        )}
        {tab === "audit" && (
          <section className="admin-card">
            <h2>최근 관리자 작업 100건</h2>
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>작업</th>
                    <th>대상</th>
                    <th>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a, i) => (
                    <tr key={i}>
                      <td>{new Date(a.created_at).toLocaleString("ko-KR")}</td>
                      <td>{actions[a.action] ?? a.action}</td>
                      <td>{a.target ?? "—"}</td>
                      <td>{a.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <footer className="admin-footer">
          방로그 Plus {releaseLabel} · 개인정보 원문과 API 키는 이 화면에
          표시하지 않습니다.
        </footer>
      </main>
    </div>
  );
}
