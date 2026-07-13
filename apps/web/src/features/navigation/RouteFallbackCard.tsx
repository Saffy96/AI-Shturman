export function RouteFallbackCard({ text, loading, onConfirm }: { text: string; loading: boolean; onConfirm: () => void }) {
  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
      <h3 className="font-black">Реальный маршрут временно недоступен</h3>
      <p className="mt-2 text-sm font-semibold opacity-80">{text}</p>
      <button className="mt-4 min-h-12 w-full rounded-xl bg-amber-300 px-4 font-black text-amber-950 disabled:opacity-50" type="button" onClick={onConfirm} disabled={loading}>Использовать приблизительный режим</button>
    </section>
  );
}
