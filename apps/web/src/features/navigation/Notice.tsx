export function Notice({ text, tone = "neutral" }: { text: string; tone?: "danger" | "neutral" }) {
  const colors = tone === "danger" ? "border-rose-400/20 bg-rose-500/15 text-rose-100" : "border-white/10 bg-[#10151d]/95 text-slate-200";
  return <div role={tone === "danger" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm font-bold shadow-2xl backdrop-blur-xl ${colors}`}>{text}</div>;
}
