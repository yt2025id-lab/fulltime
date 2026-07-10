import { useLang } from "../lib/i18n/context";

export default function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "id" : "en")}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono font-semibold tracking-wide border transition-colors bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
      title={lang === "en" ? "Switch to Indonesian" : "Ganti ke Inggris"}
    >
      <span className={lang === "en" ? "text-amber-400" : "text-white/50"}>EN</span>
      <span className="text-white/30">/</span>
      <span className={lang === "id" ? "text-amber-400" : "text-white/50"}>ID</span>
    </button>
  );
}
