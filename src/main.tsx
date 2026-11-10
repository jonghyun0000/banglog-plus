import { publicDashboardAllowed } from "../shared/release";
import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/tokens.css";
const PublicAdmin = lazy(() => import("./features/admin/PublicAdmin"));
const Admin = lazy(() => import("./features/admin/Admin"));
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<p>화면을 불러오고 있어요.</p>}>
      {window.location.pathname === "/admin" ||
      window.location.pathname === "/admin/" ? (
        publicDashboardAllowed() &&
        !new URLSearchParams(window.location.search).has("manage") ? (
          <PublicAdmin />
        ) : (
          <Admin />
        )
      ) : (
        <App />
      )}
    </Suspense>
  </StrictMode>,
);
