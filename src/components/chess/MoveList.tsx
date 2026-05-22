import type { Move } from "chess.js";

export function MoveList({ history }: { history: Move[] }) {
  const pairs: { num: number; white?: Move; black?: Move }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ num: i / 2 + 1, white: history[i], black: history[i + 1] });
  }

  const lastIndex = history.length - 1;

  return (
    <div className="bg-panel ring-1 ring-black/5 rounded-lg flex flex-col h-[520px]">
      <div className="p-4 border-b border-zinc-950/5 flex items-center justify-between">
        <h2 className="text-sm font-medium">Notation</h2>
        <span className="text-[10px] font-medium text-zinc-400 px-1.5 py-0.5 bg-zinc-100 rounded">PGN</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {pairs.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No moves yet. White to play.</p>
        ) : (
          <div className="grid grid-cols-[3ch_1fr_1fr] gap-x-4 gap-y-2 text-sm leading-tight">
            {pairs.map((p, idx) => {
              const wIdx = idx * 2;
              const bIdx = idx * 2 + 1;
              return (
                <div key={p.num} className="contents">
                  <span className="text-zinc-400 tabular-nums">{p.num}</span>
                  <span
                    className={
                      "font-medium px-1 rounded-sm " +
                      (wIdx === lastIndex ? "bg-zinc-900 text-zinc-100" : "")
                    }
                  >
                    {p.white?.san ?? ""}
                  </span>
                  <span
                    className={
                      "font-medium px-1 rounded-sm " +
                      (bIdx === lastIndex ? "bg-zinc-900 text-zinc-100" : "text-zinc-700")
                    }
                  >
                    {p.black?.san ?? (p.white ? "—" : "")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
