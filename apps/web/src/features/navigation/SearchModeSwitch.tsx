import type { SearchMode } from "../../types/fuel";

export function SearchModeSwitch({ value, onChange }: { value: SearchMode; onChange: (mode: SearchMode) => void }) {
  return (
    <section className="mode-switch" aria-label="Режим поиска">
      <ModeButton selected={value === "nearby"} onClick={() => onChange("nearby")}>Рядом</ModeButton>
      <ModeButton selected={value === "route"} onClick={() => onChange("route")}>По маршруту</ModeButton>
    </section>
  );
}

function ModeButton({ selected, children, onClick }: { selected: boolean; children: string; onClick: () => void }) {
  return <button className="mode-switch__button" type="button" aria-pressed={selected} onClick={onClick}>{children}</button>;
}
