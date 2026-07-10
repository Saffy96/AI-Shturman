import type { ComponentProps } from "react";
import { Map } from "./Map";

export function MapContainer(props: ComponentProps<typeof Map>) {
  return <section className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/75 p-1 shadow-[0_24px_70px_rgba(15,23,42,.14)] backdrop-blur-xl">
    <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-full bg-slate-950/85 px-4 py-2 text-xs font-black uppercase tracking-wider text-white backdrop-blur">Карта маршрута</div>
    <Map {...props} />
  </section>;
}
