import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function PasswordReset({
  client,
  recovery,
  onBack,
  onComplete,
}: {
  client: SupabaseClient;
  recovery: boolean;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setError("");
    if (recovery && values.get("password") !== values.get("confirmation")) {
      setError(
        "비밀번호가 일치하지 않아요. 두 칸에 같은 비밀번호를 입력해 주세요.",
      );
      return;
    }
    setBusy(true);
    try {
      if (recovery) {
        const { error: failure } = await client.auth.updateUser({
          password: String(values.get("password")),
        });
        if (failure) {
          setError(
            "변경하지 못했어요. 이전과 다른 비밀번호를 사용해 주세요. 링크가 만료되었다면 재설정 메일을 다시 요청해 주세요.",
          );
          return;
        }
        form.reset();
        onComplete();
      } else {
        const { error: failure } = await client.auth.resetPasswordForEmail(
          String(values.get("email")).trim().toLowerCase(),
          {
            redirectTo: new URL(
              "/?account=1",
              window.location.origin,
            ).toString(),
          },
        );
        if (failure) {
          setError(
            "메일 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
          );
          return;
        }
        setSent(true);
      }
    } catch {
      setError("연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="result-card">
      <h2>{recovery ? "새 비밀번호 설정" : "비밀번호 찾기"}</h2>
      <p>
        {recovery
          ? "현도컴퍼니 공통 계정의 비밀번호가 함께 변경돼요."
          : "가입에 사용한 이메일로 비밀번호 재설정 링크를 요청하세요. 메일은 요청한 브라우저에서 열어 주세요."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sent ? (
        <p className="success" role="status">
          가입된 이메일이라면 재설정 메일을 받을 수 있어요. 스팸함도 확인해
          주세요. 메일이 오지 않으면 잠시 후 다시 요청해 주세요.
        </p>
      ) : (
        <form
          className="account-login"
          onSubmit={(event) => void submit(event)}
        >
          {recovery ? (
            <>
              <label>
                새 비밀번호
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                새 비밀번호 확인
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  disabled={busy}
                />
              </label>
              <p className="small">10자 이상으로 입력해 주세요.</p>
            </>
          ) : (
            <label>
              가입 이메일
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                disabled={busy}
              />
            </label>
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {busy
              ? "처리 중…"
              : recovery
                ? "비밀번호 변경하기"
                : "재설정 메일 받기"}
          </button>
        </form>
      )}
      <button className="text-button" disabled={busy} onClick={onBack}>
        {recovery ? "재설정 취소" : "로그인으로 돌아가기"}
      </button>
    </section>
  );
}
