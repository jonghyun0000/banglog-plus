import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/hosted",
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: process.env.HOSTED_URL || "http://127.0.0.1:4173",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
  },
  webServer: process.env.HOSTED_URL
    ? undefined
    : {
        command:
          "npm run build:demo && npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 60000,
      },
});
