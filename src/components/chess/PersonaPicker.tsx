import { BOT_PERSONAS, type BotPersona } from "@/lib/bot-personas";

export function PersonaPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Choose your opponent
      </p>
      <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
        {BOT_PERSONAS.map((p) => (
          <PersonaRow
            key={p.id}
            persona={p}
            selected={p.id === value}
            onClick={() => onChange(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PersonaRow({
  persona,
  selected,
  onClick,
}: {
  persona: BotPersona;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-3 rounded p-2 text-left transition-colors cursor-pointer ring-1 " +
        (selected
          ? "bg-zinc-900 text-zinc-100 ring-zinc-900"
          : "bg-panel ring-black/5 hover:bg-zinc-100")
      }
    >
      <div
        className={
          "size-9 shrink-0 rounded-sm flex items-center justify-center text-sm font-bold " +
          (selected ? "bg-zinc-100 text-zinc-900" : "bg-zinc-200 text-zinc-700")
        }
      >
        {persona.avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{persona.name}</p>
        <p className={"text-[11px] truncate " + (selected ? "text-zinc-400" : "text-zinc-500")}>
          {persona.hometown} · {persona.tagline}
        </p>
      </div>
      <span
        className={
          "font-mono text-xs font-bold tabular-nums " +
          (selected ? "text-zinc-100" : "text-primary")
        }
      >
        {persona.rating}
      </span>
    </button>
  );
}
