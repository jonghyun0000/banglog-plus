import type { PhotoUpload } from "../../shared/photo";
import { createBrowserDemo } from "./browser-demo";
import type {
  Analysis,
  AppConfig,
  Feedback,
  Intake,
} from "../../shared/schema";
import { analysisSchema, consentVersion } from "../../shared/schema";
const browserOnly =
  import.meta.env.MODE === "hosted" &&
  import.meta.env.VITE_CONNECTED_MODE !== "true";
let token: string | null = null;
const base = import.meta.env.VITE_API_BASE_URL ?? "";
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401) token = null;
    const error = await response
      .json()
      .catch(() => ({ message: "서버에 연결하지 못했어요." }));
    throw new Error(error.message ?? "요청을 처리하지 못했어요.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
const serverApi = {
  config: () => request<AppConfig>("/config"),
  async session() {
    if (token) return;
    const data = await request<{ token: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ noticeAccepted: true, consentVersion }),
    });
    token = data.token;
  },
  async analyze(
    intake: Intake,
    key: string,
    signal: AbortSignal,
    photos?: PhotoUpload,
  ) {
    return analysisSchema.parse(
      await request<Analysis>("/analyses", {
        method: "POST",
        body: JSON.stringify({ intake, idempotencyKey: key, photos }),
        signal,
      }),
    );
  },
  cancel: (key: string) =>
    request<void>("/analyses/cancel", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: key }),
    }),
  feedback: (id: string, data: Feedback) =>
    request<void>(`/analyses/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  copied: (id: string) =>
    request<void>(`/analyses/${id}/events`, {
      method: "POST",
      body: JSON.stringify({ event: "copy_success" }),
    }),
  async remove() {
    if (token) await request<void>("/session", { method: "DELETE" });
    token = null;
  },
  hasSession: () => !!token,
};

export const api: typeof serverApi = browserOnly
  ? createBrowserDemo()
  : serverApi;

export const guestProof = () => (browserOnly ? null : token);
