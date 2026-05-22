import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { explainPosition, recapGame } from "@/lib/coach.functions";

type Props = {
  fen: string;
  turn: "w" | "b";
  pgn: string;
  hasMoves: boolean;
};

export function AiCoachPanel({ fen, turn, pgn, hasMoves }: Props) {
  const explain = useServerFn(explainPosition);
  const recap = useServerFn(recapGame);
  const [loading, setLoading] = useState<null | "explain" | "recap">(null);
  const [output, setOutput] = useState<{ kind: "explain" | "recap"; markdown: string; key: string } | null>(null);
  const cache = useRef<Map<string, string>>(new Map());

  const runExplain = useCallback(async () => {
    const cacheKey = `explain:${fen}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setOutput({ kind: "explain", markdown: cached, key: cacheKey });
      return;
    }
    setLoading("explain");
    try {
      const res = await explain({ data: { fen } });
      if (res.error) toast.error(res.error);
      else if (res.markdown) {
        cache.current.set(cacheKey, res.markdown);
        setOutput({ kind: "explain", markdown: res.markdown, key: cacheKey });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(null);
    }
  }, [fen, explain]);

  const runRecap = useCallback(async () => {
    if (!hasMoves) {
      toast.error("Load or play a game first.");
      return;
    }
    const cacheKey = `recap:${pgn}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setOutput({ kind: "recap", markdown: cached, key: cacheKey });
      return;
    }
    setLoading("recap");
    try {
      const res = await recap({ data: { pgn } });
      if (res.error) toast.error(res.error);
      else if (res.markdown) {
        cache.current.set(cacheKey, res.markdown);
        setOutput({ kind: "recap", markdown: res.markdown, key: cacheKey });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(null);
    }
  }, [pgn, hasMoves, recap]);

  const btn =
    "py-2 px-3 text-sm font-medium rounded ring-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="bg-panel ring-1 ring-black/5 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">AI Coach</h2>
        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
          {turn === "w" ? "White to move" : "Black to move"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={runExplain}
          disabled={loading !== null}
          className={btn + " bg-zinc-900 text-zinc-100 ring-zinc-900 hover:bg-zinc-800"}
        >
          {loading === "explain" ? "Thinking…" : "Explain position"}
        </button>
        <button
          onClick={runRecap}
          disabled={loading !== null || !hasMoves}
          className={btn + " bg-panel text-zinc-700 ring-black/5 hover:bg-zinc-100"}
        >
          {loading === "recap" ? "Thinking…" : "Recap game"}
        </button>
      </div>

      <div className="font-mono text-[10px] text-zinc-400 break-all leading-relaxed">{fen}</div>

      {output && (
        <div className="prose prose-sm prose-zinc max-w-none border-t border-zinc-950/5 pt-3 text-sm leading-relaxed">
          <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 not-prose">
            {output.kind === "explain" ? "Position assessment" : "Game recap"}
          </p>
          <ReactMarkdown>{output.markdown}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
