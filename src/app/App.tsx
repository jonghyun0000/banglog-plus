import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, AppConfig, Intake, Issue } from "../../shared/schema";
import { consentVersion, defaultIntake } from "../../shared/schema";
import { sanitizeIntake } from "../../shared/safety";
import { api } from "./api";
import { clearDraft, loadDraft, saveDraft } from "./draft";
import { References } from "../features/references/References";
import { Home, IssuePicker } from "../features/intake/Start";
import { Questions } from "../features/questions/Questions";
import { Review } from "../features/questions/Review";
import { Result } from "../features/analysis/Result";
import { Message } from "../features/message/Message";
import { Feedback } from "../features/feedback/Feedback";
import { Button, SectionTitle } from "../components/ui/Elements";
type Screen =
  | "home"
  | "issue"
  | "questions"
  | "review"
  | "loading"
  | "result"
  | "message"
  | "feedback"
  | "privacy"
  | "references";
type Location = { screen: Screen; step: number };
export default function App() {
  const [draft] = useState(loadDraft);
  const [location, setLocation] = useState<Location>(
    draft
      ? { screen: draft.screen, step: draft.step }
      : { screen: "home", step: 0 },
  );
  const { screen, step } = location;
  const [input, setInput] = useState<Intake>(
    draft ? draft.input : { ...defaultIntake },
  );
  const [restored, setRestored] = useState(!!draft);
  const [result, setResult] = useState<Analysis | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  const pending = useRef<{ key: string; controller: AbortController } | null>(
    null,
  );
  const busy = useRef(false);
  const version = useRef(draft ? draft.input.inputVersion : 1);
  const go = useCallback((next: Screen, nextStep = 0, replace = false) => {
    const value = { screen: next, step: nextStep };
    window.history[replace ? "replaceState" : "pushState"](value, "");
    setLocation(value);
    setError("");
    setNotice("");
    setRestored(false);
  }, []);
  useEffect(() => {
    let alive = true;
    api
      .config()
      .then((c) => {
        if (alive) setConfig(c);
      })
      .catch(() => {
        if (alive)
          setError(
            "서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
          );
      });
    return () => {
      alive = false;
    };
  }, [configAttempt]);
  useEffect(() => {
    window.history.replaceState(
      draft
        ? { screen: draft.screen, step: draft.step }
        : { screen: "home", step: 0 },
      "",
    );
    const onPop = (event: PopStateEvent) => {
      const p = pending.current;
      if (p) {
        p.controller.abort();
        void api.cancel(p.key).catch(() => {});
        pending.current = null;
        busy.current = false;
        setPreparing(false);
      }
      const target = event.state as Location | null;
      setLocation(
        target?.screen === "loading"
          ? { screen: "review", step: 0 }
          : (target ?? { screen: "home", step: 0 }),
      );
      setError("");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [draft]);
  useEffect(() => {
    // 새로고침·앱 전환으로 페이지가 다시 열려도 작성 중인 입력을 잃지 않게 한다.
    if (screen === "questions") {
      saveDraft({ input, screen, step });
    } else if (
      ["review", "loading", "result", "message", "feedback"].includes(screen)
    ) {
      saveDraft({ input, screen: "review", step: 0 });
    } else if (screen === "home" && input.inputVersion === 1) {
      clearDraft();
    }
  }, [input, screen, step]);
  function discardDraft() {
    clearDraft();
    setResult(null);
    setInput({ ...defaultIntake });
    version.current = 1;
    setAccepted(false);
    go("home", 0, true);
    setNotice("이 탭에 보관하던 입력을 지웠어요.");
  }
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [screen, step]);
  function change(patch: Partial<Intake>) {
    version.current++;
    setInput((previous) => ({
      ...previous,
      ...patch,
      inputVersion: version.current,
    }));
    setResult(null);
  }
  function pick(issue: Issue) {
    version.current++;
    setInput({ ...defaultIntake, issue, inputVersion: version.current });
    setResult(null);
    go("questions");
  }
  async function analyze() {
    if (busy.current) return;
    busy.current = true;
    setPreparing(true);
    setError("");
    try {
      await api.session();
      const key = crypto.randomUUID();
      const controller = new AbortController();
      pending.current = { key, controller };
      go("loading");
      const response = await api.analyze(
        sanitizeIntake(input),
        key,
        controller.signal,
      );
      if (pending.current?.key !== key) return;
      setResult(response);
      go("result", 0, true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      go("review", 0, true);
      setError(e instanceof Error ? e.message : "분석 중 문제가 생겼어요.");
      version.current++;
      setInput((p) => ({ ...p, inputVersion: version.current }));
    } finally {
      busy.current = false;
      setPreparing(false);
      pending.current = null;
    }
  }
  async function cancel() {
    const p = pending.current;
    if (!p) return;
    p.controller.abort();
    pending.current = null;
    try {
      await api.cancel(p.key);
      go("review", 0, true);
      setNotice(
        config?.ai === "live"
          ? "분석을 취소했어요. 이미 시작된 외부 AI 호출 비용은 취소되지 않을 수 있어요."
          : "분석을 취소했어요.",
      );
    } catch {
      go("review", 0, true);
      setError(
        "화면 대기는 중단했지만 서버 취소를 확인하지 못했어요. 기록 삭제를 다시 시도할 수 있어요.",
      );
    }
    version.current++;
    setInput((i) => ({ ...i, inputVersion: version.current }));
    busy.current = false;
    setPreparing(false);
  }
  async function remove() {
    setDeleting(true);
    setError("");
    try {
      await api.remove();
      pending.current?.controller.abort();
      pending.current = null;
      clearDraft();
      setResult(null);
      setInput({ ...defaultIntake });
      version.current = 1;
      setAccepted(false);
      setDeleteConfirm(false);
      go("home", 0, true);
      setNotice(
        config?.storage === "browser"
          ? "현재 세션의 브라우저 기록을 삭제했어요."
          : "현재 세션의 서버 기록을 삭제했어요. 공급자·백업의 보관까지 즉시 삭제됐다는 뜻은 아니에요.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했어요.");
    } finally {
      setDeleting(false);
    }
  }
  const showResult =
    ["result", "message", "feedback"].includes(screen) &&
    result?.inputVersion === input.inputVersion;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="app-header">
        <span className="brand">
          방로그 <span>Plus</span>
        </span>
        {config && (
          <span className="mode-label">
            {config.ai === "mock" ? "데모" : "내부 검증"}
          </span>
        )}
      </header>
      <main id="main">
        <div className="top-nav">
          {screen !== "home" && screen !== "loading" && (
            <button
              className="back-button"
              aria-label="뒤로가기"
              onClick={() => {
                if (screen === "questions" && step > 0)
                  go("questions", step - 1);
                else if (screen === "review") go("questions", 6);
                else if (["message", "feedback"].includes(screen)) go("result");
                else if (screen === "result") go("review");
                else go("home");
              }}
            >
              ← <span>이전</span>
            </button>
          )}
          {!["home", "privacy", "issue", "references"].includes(screen) && (
            <p className="flow-indicator">
              <span className={screen === "questions" ? "current" : ""}>
                상황 확인
              </span>
              <span aria-hidden="true">›</span>
              <span
                className={
                  ["review", "loading"].includes(screen) ? "current" : ""
                }
              >
                내용 검토
              </span>
              <span aria-hidden="true">›</span>
              <span className={showResult ? "current" : ""}>결과</span>
            </p>
          )}
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            {!config && (
              <button
                className="text-button"
                onClick={() => {
                  setError("");
                  setConfigAttempt((c) => c + 1);
                }}
              >
                연결 다시 시도
              </button>
            )}
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {restored && (
          <p className="notice" role="status">
            이 탭에서 작성하던 입력을 불러왔어요. 결과는 다시 확인해야 해요.{" "}
            <button className="text-button" onClick={discardDraft}>
              입력 지우고 처음부터
            </button>
          </p>
        )}
        {screen === "home" && (
          <Home
            onStart={() => go("issue")}
            onPrivacy={() => go("privacy")}
            onReferences={() => go("references")}
          />
        )}
        {screen === "references" && <References onStart={() => go("issue")} />}
        {screen === "issue" && <IssuePicker onPick={pick} />}
        {screen === "questions" && (
          <>
            <div className="mode-note">
              {config?.ai === "mock"
                ? "데모: 가상 결과 · 외부 AI 전송 없음"
                : "AI 보조 안내 · 내부 검증용"}
            </div>
            <Questions
              input={input}
              step={step}
              onChange={change}
              onNext={() => {
                if (step === 6) {
                  setInput(sanitizeIntake(input));
                  go("review");
                } else go("questions", step + 1);
              }}
            />
          </>
        )}
        {screen === "review" && (
          <Review
            input={sanitizeIntake(input)}
            config={config}
            accepted={accepted}
            onAccept={setAccepted}
            onEdit={(s) => {
              setResult(null);
              go("questions", s);
            }}
            onAnalyze={() => void analyze()}
            busy={preparing}
          />
        )}
        {screen === "loading" && (
          <div className="loading-screen">
            <span className="loading-ring" aria-hidden="true" />
            <SectionTitle
              eyebrow="분석 요청 중"
              title={
                config?.ai === "mock"
                  ? "데모 가이드를 만들고 있어요"
                  : "입력한 내용을 확인하고 있어요"
              }
            >
              <p>완료되면 결과를 보여드릴게요.</p>
            </SectionTitle>
            <p role="status" className="small">
              요청한 분석의 응답을 기다리고 있어요.
            </p>
            <Button secondary onClick={() => void cancel()}>
              분석 취소하기
            </Button>
          </div>
        )}
        {showResult && screen === "result" && (
          <Result
            result={result!}
            issue={input.issue}
            onMessage={() => go("message")}
            onEdit={() => {
              setResult(null);
              go("review");
            }}
            onFeedback={() => go("feedback")}
          />
        )}
        {showResult && screen === "message" && (
          <Message
            key={result!.analysisId}
            result={result!}
            onFeedback={() => go("feedback")}
          />
        )}
        {showResult && screen === "feedback" && (
          <Feedback
            id={result!.analysisId}
            localOnly={config?.storage === "browser"}
            onDone={() => go("result")}
          />
        )}
        {["result", "message", "feedback"].includes(screen) && !showResult && (
          <>
            <SectionTitle title="입력이 변경됐어요">
              <p>현재 입력으로 다시 확인해 주세요.</p>
            </SectionTitle>
            <Button onClick={() => go("review")}>입력 확인하기</Button>
          </>
        )}
        {screen === "privacy" && (
          <>
            <SectionTitle
              eyebrow="개인정보·이용 안내"
              title="필요한 내용만 잠시 보관해요"
            />
            <div className="prose">
              <h2>회원가입 없이 이용해요</h2>
              <p>
                질문 답변, 상황 설명, 선택 입력한 계약 문장, 결과, 피드백과 최소
                이용 이벤트를 분석·조회·삭제 기능에 사용해요.
                주소·연락처·주민번호·계좌번호·계약서 전체는 입력하지 마세요.
              </p>
              {config?.storage === "browser" ? (
                <>
                  <h2>이 브라우저에서만 체험해요</h2>
                  <p>
                    입력·결과·피드백은 이 브라우저에만 있어요. 서버나 외부 AI로
                    전송하지 않아요. 작성 중인 입력은 이 탭의 임시 저장소에 두어
                    새로고침해도 이어서 쓸 수 있고, 탭을 닫으면 사라져요. 결과와
                    피드백은 새로고침하면 사라져요. 입력 지우기와 기록 삭제
                    버튼으로 직접 지울 수 있어요.
                  </p>
                  <p>
                    피드백도 체험용이며 운영자에게 전달되지 않아요. 사이트
                    파일을 불러올 때 호스팅 서비스에 일반 접속 정보가 남을 수
                    있어요.
                  </p>
                </>
              ) : (
                <>
                  <h2>최대 24시간 임시 보관해요</h2>
                  <p>
                    메모리 모드는 서버 메모리에, DB 모드는 서버 DB에 보관해요.
                    서버 메모리는 재시작 시 없어져요. 분석 후 기록 삭제 버튼으로
                    직접 삭제할 수 있어요. 만료된 기록은 1분 간격 정리
                    대상이에요.
                  </p>
                  <p>
                    접근 토큰은 브라우저 메모리에만 있어요. 새로고침하면 결과를
                    다시 볼 수 없지만, 서버 기록은 만료·정리 때까지 남을 수
                    있어요. 장기 보관·재접근 기능은 제공하지 않아요.
                  </p>
                  <p>
                    작성 중인 입력은 이 탭의 임시 저장소에도 두어 새로고침해도
                    이어서 쓸 수 있어요. 탭을 닫거나 입력 지우기·기록 삭제를
                    누르면 사라져요.
                  </p>
                </>
              )}
              <h2>외부 AI 처리</h2>
              <p>
                데모는 외부 AI로 보내지 않아요. 실제 모드에서는 가린 설명·선택
                답변·계약 문구를 OpenAI에 전송해요. 응답 저장은 store:false로
                비활성화하지만 악용 모니터링 기록이 기본 최대 30일 보관될 수
                있어요. 제공자 계정의 실제 보관 설정은 공개 전 추가 확인해야
                해요.
              </p>
              <h2>별도 연구 동의는 받지 않아요</h2>
              <p>
                현재 버전에는 선택 보관·원문 연구·사진 기능이 없어요. 기본
                이용에 필요한 처리 안내 확인만 받아요. 피드백은 선택이며 원문을
                학습·연구용으로 별도 수집하지 않아요.
              </p>
              <h2>법적 판단을 확정하지 않아요</h2>
              <p>
                데모는 가상 결과예요. 실제 AI도 입력과 근거에 따른 조건부
                안내이며 사람의 법률 검토·공개 출시 승인 전 단계예요.
              </p>
              <p className="small">안내 버전 {consentVersion}</p>
            </div>
            <Button secondary onClick={() => go("home")}>
              홈으로 돌아가기
            </Button>
          </>
        )}
      </main>
      {api.hasSession() && (
        <footer className="session-footer">
          {deleteConfirm ? (
            <div className="delete-confirm">
              <p>
                현재 세션의 입력·결과·피드백을 삭제할까요? 삭제 후에는 복구할 수
                없어요.
              </p>
              <button
                className="text-button danger"
                disabled={deleting}
                onClick={() => void remove()}
              >
                {deleting ? "삭제 중…" : "기록 삭제 확인"}
              </button>
              <button
                className="text-button"
                onClick={() => setDeleteConfirm(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              className="text-button muted"
              onClick={() => setDeleteConfirm(true)}
            >
              현재 세션 기록 삭제
            </button>
          )}
          <p className="small">
            {config?.storage === "browser"
              ? "브라우저 임시 보관 · 결과는 새로고침하면 삭제"
              : `${config?.storage === "database" ? "서버 DB" : "서버 메모리"} 임시 보관 · 최대 24시간`}
          </p>
        </footer>
      )}
      {!api.hasSession() && ["questions", "review"].includes(screen) && (
        <footer className="session-footer">
          <button className="text-button muted" onClick={discardDraft}>
            입력한 내용 지우기
          </button>
          <p className="small">
            작성 중인 입력은 이 탭에만 임시 보관 · 탭을 닫으면 삭제
          </p>
        </footer>
      )}
    </div>
  );
}
