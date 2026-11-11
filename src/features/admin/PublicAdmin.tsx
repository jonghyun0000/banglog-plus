import { useEffect, useState } from "react";
import type { PublicDashboard } from "../../../shared/admin";
import { issueNames, type Issue } from "../../../shared/schema";
import { answerLabel, options, observations } from "../../../shared/questions";
import { releaseLabel } from "../../../shared/release";
import { Status } from "../status/Status";
import "./admin.css";
const questionNames: Record<string, string> = {
  observation: "보이는 증상",
  discovered: "발견 시점",
  preexisting: "입주 당시 상태",
  installed: "시설 제공 주체",
  cause: "알고 있는 원인",
  causeSource: "원인 설명 출처",
  otherClaim: "다른 주장",
  contact: "연락 상태",
  safety: "위험 신호",
};
function answerName(issue: Issue, question: string, answer: string) {
  return question === "observation"
    ? (observations[issue]?.find(([v]) => v === answer)?.[1] ?? answer)
    : question in options
      ? answerLabel(question as keyof typeof options, answer)
      : answer;
}
export default function PublicAdmin() {
  const [data, setData] = useState<PublicDashboard | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [tab, setTab] = useState("overview"),
    [issue, setIssue] = useState<Issue | "all">("all");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/dashboard", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            r.status === 404
              ? "공개 기간이 종료되었어요. 운영자 로그인으로 확인해 주세요."
              : "현황을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.",
          );
        return r.json() as Promise<PublicDashboard>;
      })
      .then((d) => {
        if (!controller.signal.aborted) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "연결 확인 필요");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  const total = data?.usage.reduce((n, r) => n + r.count, 0) ?? 0;
  const live =
    data?.usage
      .filter((r) => r.mode === "live")
      .reduce((n, r) => n + r.count, 0) ?? 0;
  const cases =
    data?.knowledge.filter((k) => k.source.title.includes("법원")).length ?? 0;
  const filtered =
    data?.knowledge.filter(
      (k) => issue === "all" || k.issues.includes(issue),
    ) ?? [];
  return (
    <div className="admin-shell public-admin">
      <aside className="admin-sidebar">
        <a href="/" className="admin-brand">
          <img src="/logo.svg" alt="" />
          방로그 Plus
        </a>
        <p className="admin-version">{releaseLabel} · 팀 체험 공개 화면</p>
        <nav aria-label="공개 관리자 메뉴">
          {[
            ["overview", "사용 현황"],
            ["answers", "선택 답변 통계"],
            ["knowledge", "법률·판례 자료"],
            ["guide", "팀원 체험 안내"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <a className="button primary" href="/">
          앱 사용해 보기
        </a>
        <a className="small" href="/admin?manage=1">
          운영자 로그인
        </a>
      </aside>
      <main className="admin-main" id="main">
        <header className="admin-heading">
          <div>
            <p className="eyebrow">PUBLIC DASHBOARD · {releaseLabel}</p>
            <h1>방로그 사용 현황</h1>
            <p>로그인 없이 통계와 근거 자료를 살펴보세요.</p>
          </div>
          <button
            className="text-button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRefresh((v) => v + 1);
            }}
          >
            새로고침
          </button>
        </header>
        <p className="notice">
          v1.4 팀 체험 기간에는 이 화면을 공개합니다. 회원 개인정보·개별 입력
          원문·삭제 기능은 공개하지 않으며, 운영자 로그인 후 관리할 수 있어요.
        </p>
        {loading && <p role="status">최신 현황을 불러오고 있어요…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {data && tab === "overview" && (
          <>
            <div className="admin-metrics">
              <article>
                <p>최근 30일 분석 완료</p>
                <strong>{total.toLocaleString()}건</strong>
              </article>
              <article>
                <p>실제 GPT 결과</p>
                <strong>{live.toLocaleString()}건</strong>
              </article>
              <article>
                <p>검색 근거 문단</p>
                <strong>{data.knowledge.length}개</strong>
              </article>
              <article>
                <p>법원 판례 자료</p>
                <strong>{cases}개</strong>
              </article>
            </div>
            <section className="admin-card">
              <h2>어떤 문제를 확인했나요?</h2>
              {(Object.keys(issueNames) as Issue[]).map((key) => {
                const count = data.usage
                  .filter((r) => r.issue === key)
                  .reduce((n, r) => n + r.count, 0);
                return (
                  <div className="admin-bar" key={key}>
                    <span>{issueNames[key]}</span>
                    <progress
                      value={count}
                      max={Math.max(total, 1)}
                      aria-label={`${issueNames[key]} 분석 비중`}
                    />
                    <strong>{count}건</strong>
                  </div>
                );
              })}
            </section>
            <p className="small">
              완료 건수는 고유 사용자 수가 아니며, 개발 중 가상 사례 검증도
              포함됩니다. 기본 안내·데모 결과는 실제 GPT 결과에 포함하지
              않습니다.
            </p>
          </>
        )}
        {data && tab === "answers" && (
          <section className="admin-card">
            <h2>질문별 선택 답변</h2>
            <p>
              최근 30일의 선택 횟수예요. 자유 설명·이름·이메일은 수집해 표시하지
              않습니다.
            </p>
            <label>
              문제 유형
              <select
                value={issue}
                onChange={(e) => setIssue(e.target.value as Issue | "all")}
              >
                <option value="all">전체</option>
                {Object.entries(issueNames).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>문제</th>
                    <th>질문</th>
                    <th>선택 답변</th>
                    <th>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.answers
                    .filter((r) => issue === "all" || r.issue === issue)
                    .map((r, i) => (
                      <tr key={i}>
                        <td>{issueNames[r.issue]}</td>
                        <td>{questionNames[r.question] ?? r.question}</td>
                        <td>{answerName(r.issue, r.question, r.answer)}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!data.answers.length && <p>아직 집계된 답변이 없어요.</p>}
            <p className="small">
              배수의 새 세부 질문은 개인 결과에 저장되며, 이 집계에는 기존 공통
              질문만 포함됩니다.
            </p>
          </section>
        )}
        {data && tab === "knowledge" && (
          <section>
            <h2>답변에 참고하는 법률·판례</h2>
            <p>원문·기술 확인과 법률 전문가 검토는 구분해 표시합니다.</p>
            <label>
              문제 유형
              <select
                value={issue}
                onChange={(e) => setIssue(e.target.value as Issue | "all")}
              >
                <option value="all">전체</option>
                {Object.entries(issueNames).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {filtered.map((k) => (
              <article className="admin-card" key={k.id}>
                <h3>
                  <a href={k.source.url} target="_blank" rel="noreferrer">
                    {k.source.title} ↗
                  </a>
                </h3>
                <p>{k.claim}</p>
                <p className="small">적용 범위: {k.source.scope}</p>
                <p className="small">
                  원문·기술 확인:{" "}
                  {k.source.technicalStatus === "verified" ? "확인됨" : "대기"}{" "}
                  · 전문가 법률 검토:{" "}
                  {k.source.humanLegalReview === "approved" ? "승인" : "대기"}
                </p>
                <details>
                  <summary>자료 상세 보기</summary>
                  <p>{k.content}</p>
                  <p className="small">
                    {k.source.institution} · {k.source.location}
                    <br />
                    확인일: {k.source.checkedAt}
                    <br />
                    버전: {k.source.version}
                  </p>
                </details>
              </article>
            ))}
          </section>
        )}
        {tab === "guide" && (
          <section className="admin-card">
            <h2>팀원 체험 순서</h2>
            <ol className="response-steps">
              <li>
                <h3>로그인 없이 수리 문제 확인</h3>
                <p>
                  가상 상황으로 문제를 선택하고 질문에 답해 보세요. 배수는
                  증상과 해본 조치에 따라 질문이 달라져요.
                </p>
              </li>
              <li>
                <h3>결과와 문구 확인</h3>
                <p>
                  안전하게 할 일, 연락할 대상, 비용 조건과 근거를 확인하고
                  집주인에게 보낼 문구를 수정·복사해 보세요.
                </p>
              </li>
              <li>
                <h3>선택적으로 기록 저장</h3>
                <p>
                  이메일로 가입·인증하거나 기존 현도컴퍼니 계정으로
                  로그인하세요. 저장 동의 후 내 기록에서 다시 열어 보세요.
                </p>
              </li>
              <li>
                <h3>불편했던 부분 공유</h3>
                <p>
                  문제 유형, 선택한 답변, 기대한 안내와 실제 안내, 사용한 기기를
                  팀에 알려주세요. 결과 하단의 의견 남기기도 이용할 수 있어요.
                </p>
              </li>
            </ol>
            <a className="button primary" href="/">
              체험 시작하기
            </a>
            <p className="small">
              실제 주소·연락처·계약 당사자 정보는 입력하지 마세요. GPT 오류나
              한도 초과 때에는 기본 안내가 표시될 수 있어요.
            </p>
          </section>
        )}
        <footer className="admin-footer">
          <p>
            {data
              ? `${new Date(data.checkedAt).toLocaleString("ko-KR")} 기준 · 최대 30초 간격으로 갱신`
              : releaseLabel}
          </p>
          <p>
            공개 통계는 조회 전용입니다. v2.0부터 공개 접근을 종료하도록 버전
            기준을 설정했습니다.
          </p>
          <Status compact />
        </footer>
      </main>
    </div>
  );
}
