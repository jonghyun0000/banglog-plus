import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { include: ["@supabase/supabase-js"] },
  server: {
    port: 5173,
    strictPort: true,
    // E2E 중 파일 변경(스크린샷·문서·결과 파일)이 페이지를 새로고침해
    // 메모리 상태를 지우지 않도록 감시와 HMR을 끈다.
    ...(process.env.E2E_NO_WATCH ? { watch: null, hmr: false } : {}),
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
