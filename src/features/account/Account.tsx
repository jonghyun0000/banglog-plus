import { PhotoResult } from "../photos/PhotoResult";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { AppConfig } from "../../../shared/schema";
import { intakeIssueName, directionNames } from "../../../shared/schema";
import {
  historySchema,
  historyConsentVersion,
  type HistoryEntry,
} from "../../../shared/account";
import { PasswordReset } from "./PasswordReset";
import { DraftEditor } from "../message/DraftEditor";
import { NextResponse } from "../analysis/NextResponse";
import { guestProof } from "../../app/api";
import { Button, SectionTitle } from "../../components/ui/Elements";

const historyDateFormat = new Intl.DateTimeFormat("sv-SE");

let authClient:
  | {
      key: string;
      client: SupabaseClient;
      recovery: boolean;
      unsubscribe: () => void;
    }
  | undefined;
function getClient(account: AppConfig["account"]) {
  if (!account?.enabled) return null;
  const key = account.url + account.publishableKey;
  if (authClient?.key === key) return authClient.client;
  authClient?.client.auth.stopAutoRefresh();
  authClient?.unsubscribe();
  const client = createClient(account.url, account.publishableKey, {
    auth: {
      flowType: new URLSearchParams(window.location.hash.slice(1)).has(
        "access_token",
      )
        ? "implicit"
        : "pkce",
      storageKey: "banglog-plus-auth",
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  const state = { key, client, recovery: false, unsubscribe: () => {} };
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") state.recovery = true;
    if (event === "SIGNED_OUT") state.recovery = false;
  });
  state.unsubscribe = () => subscription.unsubscribe();
  authClient = state;
  return client;
}
const pendingKey = "banglog-plus-save-pending";
function pendingSave(): {
  id: string;
  token: string;
  expires: number;
  editedMessage?: string;
} | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(pendingKey) ?? "null");
    if (
      p &&
      typeof p.id === "string" &&
      typeof p.token === "string" &&
      p.expires > Date.now() &&
      (p.editedMessage === undefined ||
        (typeof p.editedMessage === "string" && p.editedMessage.length <= 2000))
    )
      return p;
    sessionStorage.removeItem(pendingKey);
  } catch {
    /* Storage may be blocked. */
  }
  return null;
}
export function Account({
  config,
  analysisId,
  editedMessage,
  onHome,
}: {
  config: AppConfig | null;
  analysisId?: string;
  editedMessage?: string;
  onHome: () => void;
}) {
  const account = config?.account;
  const client = useMemo(() => getClient(account), [account]);
  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(!!client);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordFlow, setPasswordFlow] = useState<
    "request" | "recovery" | null
  >(null);
  const [signup, setSignup] = useState(false);
  const [signupConsent, setSignupConsent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(pendingSave);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(
      () => {
        sessionStorage.removeItem(pendingKey);
        setPending(null);
      },
      Math.max(0, pending.expires - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [pending]);

  const generation = useRef(0);
  const token = session?.access_token;
  const currentProof = guestProof();
  const candidate =
    analysisId && currentProof
      ? { id: analysisId, token: currentProof, editedMessage }
      : pending;
  useEffect(() => {
    if (!client) return;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setPasswordFlow("recovery");
      if (event === "SIGNED_OUT") setPasswordFlow(null);
      generation.current++;
      setSession(next);
      setRefresh((v) => v + 1);
      setAccepted(false);
      setNotice("");
      setEntries([]);
      setConfirmDelete(null);
      setError("");
      setLoading(!!next);
    });
    void client.auth.getSession().then(({ data, error: e }) => {
      if (data.session && authClient?.recovery) setPasswordFlow("recovery");
      if (e) {
        setError("로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.");
        setLoading(false);
      }
    });
    const guard = generation;
    return () => {
      guard.current++;
      subscription.unsubscribe();
    };
  }, [client]);
  useEffect(() => {
    if (!token || passwordFlow === "recovery") return;
    const controller = new AbortController();
    const current = generation.current;
    void accountRequest("", token, undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted && current === generation.current)
          setEntries(historySchema.array().parse(data));
      })
      .catch((e) => {
        if (!controller.signal.aborted && current === generation.current)
          setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted && current === generation.current)
          setLoading(false);
      });
    return () => controller.abort();
  }, [token, refresh, passwordFlow]);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (signup) {
        if (!account?.signup || !signupConsent) return;
        const password = String(form.get("password"));
        if (password !== String(form.get("confirmation")))
          throw new Error(
            "비밀번호가 일치하지 않아요. 두 칸에 같은 비밀번호를 입력해 주세요.",
          );
        const email = String(form.get("email")).trim().toLowerCase();
        const redirect = new URL(
          "/?account=1",
          window.location.origin,
        ).toString();
        if (candidate)
          sessionStorage.setItem(
            pendingKey,
            JSON.stringify({ ...candidate, expires: Date.now() + 600000 }),
          );
        const { data, error: e } = await client.auth.signUp({
          email,
          password: String(form.get("password")),
          options: { emailRedirectTo: redirect },
        });
        if (e)
          throw new Error(
            "가입 요청을 처리하지 못했어요. 잠시 후 다시 시도하거나 기존 계정으로 로그인해 주세요.",
          );
        if (data.session) {
          setSession(data.session);
          setVerificationEmail("");
          setSignup(false);
          setNotice(
            "회원가입이 완료됐어요. 내 기록을 저장하고 확인할 수 있어요.",
          );
          return;
        }
        setVerificationEmail(email);
        setNotice(
          "인증 메일을 확인해 주세요. 이미 가입한 이메일이라면 기존 비밀번호로 로그인해 주세요. 인증 링크는 가입한 브라우저에서 열어 주세요.",
        );
        setSignup(false);
        return;
      }
      const { data, error: e } = await client.auth.signInWithPassword({
        email: String(form.get("email")).trim().toLowerCase(),
        password: String(form.get("password")),
      });
      if (e)
        throw new Error(
          "이메일과 비밀번호를 확인해 주세요. 현도컴퍼니 계정으로 로그인할 수 있어요.",
        );
      if (!data.user.email_confirmed_at) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("이메일 인증을 먼저 완료해 주세요.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!client || !verificationEmail || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: e } = await client.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: {
          emailRedirectTo: new URL(
            "/?account=1",
            window.location.origin,
          ).toString(),
        },
      });
      if (e) throw e;
      setNotice(
        "인증 메일을 다시 요청했어요. 스팸함도 확인해 주세요. 연속 요청은 잠시 기다린 뒤 이용해 주세요.",
      );
    } catch {
      setError("인증 메일을 보내지 못했어요. 잠시 후 다시 요청해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!token || !candidate || !accepted) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      await accountRequest("", token, {
        method: "POST",
        headers: { "X-Guest-Token": candidate.token },
        body: JSON.stringify({
          analysisId: candidate.id,
          consentVersion: historyConsentVersion,
          ...(candidate.editedMessage?.trim()
            ? { editedMessage: candidate.editedMessage }
            : {}),
        }),
      });
      if (current !== generation.current) return;
      sessionStorage.removeItem(pendingKey);
      setPending(null);
      setNotice("내 기록에 저장했어요.");
      setRefresh((v) => v + 1);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!token) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      await accountRequest(`/${id}`, token, { method: "DELETE" });
      if (current === generation.current) {
        setEntries((v) => v.filter((x) => x.id !== id));
        setConfirmDelete(null);
        setNotice("저장한 기록을 삭제했어요.");
      }
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const { error: e } = await client!.auth.signOut({ scope: "local" });
      if (e) throw e;
      sessionStorage.removeItem(pendingKey);
      setPending(null);
      setNotice("");
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-screen">
      <SectionTitle
        eyebrow="나의 방로그"
        title={
          passwordFlow
            ? "계정 비밀번호 재설정"
            : session
              ? "내 기록"
              : "로그인해서 기록을 확인해 보세요"
        }
      >
        <p>
          {passwordFlow
            ? "이메일 확인 후 새 비밀번호를 설정할 수 있어요."
            : session
              ? "저장한 수리 안내와 연락 문구를 다시 확인하세요."
              : "저장한 결과와 연락 문구를 다시 볼 수 있어요. 처음이라면 이메일과 비밀번호로 회원가입해 주세요."}
        </p>
      </SectionTitle>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {client && passwordFlow ? (
        <PasswordReset
          key={passwordFlow}
          client={client}
          recovery={passwordFlow === "recovery"}
          onBack={() => {
            if (passwordFlow === "recovery") void logout();
            else setPasswordFlow(null);
          }}
          onComplete={() => {
            if (authClient) authClient.recovery = false;
            setPasswordFlow(null);
            setNotice(
              "비밀번호를 변경했어요. 다음 로그인부터 새 비밀번호를 사용해 주세요.",
            );
          }}
        />
      ) : !session ? (
        <section className="result-card">
          <h2>다음에도 이어서 확인하세요</h2>
          <p className="small">
            현도컴퍼니 이메일 계정으로 로그인해요. 방로그 기록은 별도로 보관하며
            최대 90일 안에 직접 삭제할 수 있어요.
          </p>
          <form
            className="account-login"
            onSubmit={(event) => void login(event)}
          >
            <label>
              이메일
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label>
              비밀번호
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 10 : 1}
                maxLength={128}
                required
              />
            </label>
            {signup && (
              <label>
                비밀번호 확인
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </label>
            )}
            {signup && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  required
                  checked={signupConsent}
                  onChange={(e) => setSignupConsent(e.target.checked)}
                />
                <span>
                  현도컴퍼니 공통 계정 생성 및 방로그 회원 관리를 위해
                  이메일·회원 ID·최근 이용 시각을 처리하는 데 동의해요. 결과
                  저장은 별도로 선택해요.
                </span>
              </label>
            )}
            <button
              className="button primary"
              disabled={
                !account?.enabled ||
                busy ||
                (signup && (!account.signup || !signupConsent))
              }
              type="submit"
            >
              {busy
                ? "처리 중…"
                : signup
                  ? "회원가입하기"
                  : "현도컴퍼니 계정으로 로그인"}
            </button>
          </form>
          {!account?.enabled && (
            <p className="notice">
              로그인 연결을 준비하고 있어요. 비회원 이용은 계속할 수 있어요.
            </p>
          )}
          {account?.signup ? (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSignup((v) => !v);
                setError("");
              }}
            >
              {signup ? "기존 계정으로 로그인" : "처음 오셨나요? 회원가입"}
            </button>
          ) : (
            <p className="small">
              신규 회원가입은 준비 중입니다. 기존 가입자는 로그인할 수 있어요.
            </p>
          )}
          {!signup && client && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setError("");
                setNotice("");
                setPasswordFlow("request");
              }}
            >
              비밀번호를 잊으셨나요?
            </button>
          )}
          {verificationEmail && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void resend()}
            >
              인증 메일 다시 보내기
            </button>
          )}
          {candidate && (
            <p className="small">
              로그인한 뒤 현재 결과를 내 기록에 저장할 수 있어요.
            </p>
          )}
        </section>
      ) : (
        <>
          <p className="small">
            로그인되어 있어요. 이 계정으로 저장한 기록만 표시합니다.
          </p>
          {candidate &&
            !entries.some(
              (entry) => entry.result.analysisId === candidate.id,
            ) && (
              <section className="result-card">
                <h2>이번 결과 보관하기</h2>
                {candidate.editedMessage && (
                  <details>
                    <summary>함께 저장할 수정 문구 확인</summary>
                    <p className="saved-message">{candidate.editedMessage}</p>
                  </details>
                )}
                <p className="small">
                  수정한 연락 문구가 있으면 함께 저장해요. 개인정보로 보이는
                  일부 내용은 가려져요.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    답변·상황 설명·결과·수정 문구를 내 계정에 최대 90일 보관하는
                    데 동의해요. 개인정보가 들어 있지 않은지 확인했어요.
                  </span>
                </label>
                <Button
                  disabled={!accepted || busy}
                  onClick={() => void save()}
                >
                  {busy ? "저장 중…" : "내 기록에 저장"}
                </Button>
              </section>
            )}
          {candidate &&
            entries.some(
              (entry) => entry.result.analysisId === candidate.id,
            ) && (
              <p className="success" role="status">
                이 결과는 이미 저장되어 있어요. 저장 후 수정한 문구는 기존
                기록에 자동 반영되지 않아요.
              </p>
            )}
          <h2 className="history-heading">
            저장한 기록 <span>{entries.length}개</span>
          </h2>
          {loading ? (
            <p role="status">기록을 불러오는 중이에요…</p>
          ) : (
            !entries.length && (
              <p className="notice">
                아직 저장한 기록이 없어요. 결과 화면에서 ‘내 기록에 저장’을 눌러
                보관하세요.
              </p>
            )
          )}
          {entries.length > 0 && (
            <div className="history-grid">
              {entries.map((entry) => (
                <section className="result-card history-card" key={entry.id}>
                  <div className="history-meta">
                    <span className="eyebrow">
                      {entry.result.fallback
                        ? "기본 안내 · AI 분석 아님"
                        : entry.result.mode === "mock"
                          ? "데모 결과"
                          : "AI 보조 안내"}
                    </span>
                    <time className="history-date" dateTime={entry.createdAt}>
                      {historyDateFormat.format(new Date(entry.createdAt))}
                    </time>
                  </div>
                  <h3>{intakeIssueName(entry.input)}</h3>
                  <p>
                    {directionNames[entry.result.costResponsibility.direction]}
                  </p>
                  <details>
                    <summary>결과·근거 보기</summary>
                    {entry.result.fallback && (
                      <p className="notice">{entry.result.fallback.notice}</p>
                    )}
                    {entry.result.aiExplanation && (
                      <p>{entry.result.aiExplanation}</p>
                    )}
                    <PhotoResult photo={entry.result.photoAnalysis} />
                    <p>{entry.result.repairRequest.reason}</p>
                    {entry.result.costResponsibility.conditions.map((c, i) => (
                      <p key={i}>{c}</p>
                    ))}
                    <p>{entry.result.costResponsibility.uncertainty}</p>
                    <h4>지금 확인할 내용</h4>
                    <ul>
                      {entry.result.nextActions.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                    <h4>저장한 연락 문구</h4>
                    <p className="saved-message">
                      {entry.result.savedMessage ?? entry.result.messageDraft}
                    </p>
                    <h4>참고 근거</h4>
                    {entry.result.citedClaims.map((c, i) => (
                      <p key={i}>{c.claim}</p>
                    ))}
                    {entry.result.sources.map((s) => (
                      <p key={s.id}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title} ↗
                        </a>
                      </p>
                    ))}
                    {entry.result.cautions.map((c, i) => (
                      <p className="small" key={i}>
                        {c}
                      </p>
                    ))}
                  </details>
                  <details className="saved-editor">
                    <summary>문구 수정·복사하기</summary>
                    <SavedDraft entry={entry} />
                  </details>
                  <details>
                    <summary>
                      {entry.result.tailoredResponse
                        ? "내 상황에 맞는 다음 대응과 근거"
                        : "법률을 참고한 다음 대응"}
                    </summary>
                    <NextResponse result={entry.result} />
                  </details>
                  <p className="small history-retention">
                    만료일{" "}
                    <time className="history-date" dateTime={entry.expiresAt}>
                      {historyDateFormat.format(new Date(entry.expiresAt))}
                    </time>
                  </p>
                  {confirmDelete === entry.id ? (
                    <>
                      <p>이 기록을 삭제할까요? 복구할 수 없어요.</p>
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() => void remove(entry.id)}
                      >
                        삭제 확인
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setConfirmDelete(null)}
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button danger"
                      onClick={() => setConfirmDelete(entry.id)}
                    >
                      기록 삭제
                    </button>
                  )}
                </section>
              ))}
            </div>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void logout()}
          >
            로그아웃
          </button>
        </>
      )}
      <Button secondary onClick={onHome}>
        홈으로 돌아가기
      </Button>
    </div>
  );
}
async function accountRequest(
  path: string,
  token: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/account/history${path}`,
    {
      ...options,
      signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "기록을 처리하지 못했어요.");
  }
  return response.status === 204 ? undefined : response.json();
}

function SavedDraft({ entry }: { entry: HistoryEntry }) {
  const original = entry.result.savedMessage ?? entry.result.messageDraft;
  const [text, setText] = useState(original);
  return (
    <>
      <p className="small">
        여기서 수정한 내용은 복사용이며 저장된 기록을 바꾸지 않아요.
      </p>
      <DraftEditor
        text={text}
        original={original}
        onChange={setText}
        label="저장한 문구 수정"
      />
    </>
  );
}
