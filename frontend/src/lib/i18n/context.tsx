import { createContext, useContext, useState, type ReactNode } from "react";
import en from "./en";
import id from "./id";

type Lang = "en" | "id";
type TFn = (key: string) => string;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}

const fallback: TFn = (k: string) => (en as any)[k] || k;

const LangContext = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: fallback });

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("fulltime-lang");
  if (saved === "id" || saved === "en") return saved;
  return navigator.language?.startsWith("id") ? "id" : "en";
}

function makeT(lang: Lang): TFn {
  const dict = lang === "id" ? id : en;
  return (key: string) => (dict as any)[key] || key;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("fulltime-lang", l);
  };

  const t = makeT(lang);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
