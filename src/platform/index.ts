export interface PlatformAdapter {
  name: "browser" | "toss";
  copy(text: string): Promise<void>;
  openSource(url: string): void;
  back(): void;
}
export const browserPlatform: PlatformAdapter = {
  name: "browser",
  async copy(text) {
    if (!navigator.clipboard?.writeText) throw new Error("COPY_UNAVAILABLE");
    await navigator.clipboard.writeText(text);
  },
  openSource(url) {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("UNSAFE_URL");
    window.open(u.href, "_blank", "noopener,noreferrer");
  },
  back() {
    window.history.back();
  },
};
// Toss bridge is supplied only after SDK/version/appName/device capabilities are verified.
export function createTossPlatform(
  verifiedBridge: Omit<PlatformAdapter, "name">,
): PlatformAdapter {
  return { name: "toss", ...verifiedBridge };
}
export const platform = browserPlatform;
