export function Header() {
  return (
    <header className="px-5 pb-5 pt-7">
      <div className="mx-auto flex max-w-xl items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-road-500 text-2xl shadow-soft">
          ⛽
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-normal text-road-900">AI Штурман</h1>
          <p className="mt-1 text-base font-medium text-slate-600">АЗС рядом по данным водителей</p>
        </div>
      </div>
    </header>
  );
}
