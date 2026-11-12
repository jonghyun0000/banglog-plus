import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { english } from "./english";

export type Language = "ko" | "en";
const preferenceKey = "banglog-plus-language";
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({ language: "ko", setLanguage: () => {} });

function initialLanguage(): Language {
  const explicit = new URLSearchParams(window.location.search).get("lang");
  if (explicit === "en" || explicit === "ko") return explicit;
  try {
    return localStorage.getItem(preferenceKey) === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, changeLanguage] = useState(initialLanguage);
  function setLanguage(next: Language) {
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", url);
    }
    changeLanguage(next);
  }
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "en"
        ? "Banglog Plus · Rental repair guide"
        : "방로그 Plus · 세입자를 위한 수리 가이드";
    try {
      localStorage.setItem(preferenceKey, language);
    } catch {
      // Language switching also works with storage disabled.
    }
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const { language, setLanguage } = useContext(LanguageContext);
  return {
    language,
    setLanguage,
    t: (text: string) => (language === "en" ? (english[text] ?? text) : text),
  };
}
