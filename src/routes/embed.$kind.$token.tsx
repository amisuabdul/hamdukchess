import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { getEmbedPayload, reportStudentBoard } from "@/lib/embed.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/embed/$kind/$token")({
  loader: ({ params }) => getEmbedPayload({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Hamduk Chess widget" },
      { name: "description", content: "Embeddable Hamduk Chess board, puzzle, leaderboard and live game widgets." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Hamduk Chess widget" },
      { property: "og:description", content: "Embeddable Hamduk Chess widgets for clubs, schools and academies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmbedWidget,
  errorComponent: () => <EmbedMessage text="This widget could not load." />,
  notFoundComponent: () => <EmbedMessage text="Widget not found." />,
});

function EmbedMessage({ text }: { text: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Brand() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 block text-center font-serif text-[10px] tracking-wide text-muted-foreground/80 hover:text-primary"
    >
      Hamduk <span className="text-primary">Chess</span>
    </a>
  );
}

function useEmbedTheme(theme: "light" | "dark" | "auto" | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark" || theme === "light") {
      root.classList.toggle("dark", theme === "dark");
      root.style.colorScheme = theme;
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.classList.toggle("dark", mq.matches);
      root.style.colorScheme = mq.matches ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

function post(message: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.parent !== window) {
    window.parent.postMessage({ source: "hamduk-chess", ...message }, "*");
  }
}

function EmbedWidget() {
  const payload = Route.useLoaderData();
  const config = "config" in payload ? payload.config : {};
  useEmbedTheme(config?.theme);

  useEffect(() => {
    if ("error" in payload) return;
    post({ type: "ready", kind: payload.kind });
  }, [payload]);

  if ("error" in payload) {
    return <EmbedMessage text={payload.error === "expired" ? "This widget link has expired." : "Widget not found."} />;
  }

  const wrapperStyle = config?.responsive === false && config?.size ? { width: config.size } : undefined;

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="mx-auto w-full max-w-[900px]" style={wrapperStyle}>
        {payload.kind === "board" && <BoardWidget payload={payload} />}
        {payload.kind === "puzzle" && <PuzzleWidget payload={payload} />}
        {payload.kind === "leaderboard" && <LeaderboardWidget payload={payload} />}
        {payload.kind === "game" && <GameWidget payload={payload} />}
        <Brand />
      </div>
    </div>
  );
}

/* ---------------- Board (also powers class-session student boards) --------------- */

type BoardPayload = Extract<Awaited<ReturnType<typeof getEmbedPayload>>, { kind: "board" }>;

function BoardWidget({ payload }: { payload: BoardPayload }) {
  const { config, data } = payload;
  const [fen, setFen] = useState(data.fen);
  const [locked, setLocked] = useState(data.locked);
  const [moves, setMoves] = useState(0);
  const label = useRef<string>("");

  if (!label.current) {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("hamduk:embed-label") : null;
    label.current = stored ?? `Student ${Math.floor(Math.random() * 9000 + 1000)}`;
    if (typeof localStorage !== "undefined") localStorage.setItem("hamduk:embed-label", label.current);
  }

  // Instructor broadcasts snap every connected student board to the new position.
  useEffect(() => {
    if (!data.sessionId) return;
    const channel = supabase
      .channel(`class:${data.sessionId}`)
      .on("broadcast", { event: "set_position" }, ({ payload: p }) => {
        const next = (p as { position_fen?: string; locked?: boolean | null })?.position_fen;
        if (next) {
          setFen(next);
          setMoves(0);
          post({ type: "position", fen: next });
        }
        const nextLocked = (p as { locked?: boolean | null })?.locked;
        if (typeof nextLocked === "boolean") setLocked(nextLocked);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data.sessionId]);

  const interactive = config?.interactive !== false && !locked;

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!interactive || !targetSquare) return false;
    try {
      const game = new Chess(fen);
      const move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!move) return false;
      setFen(game.fen());
      const count = moves + 1;
      setMoves(count);
      post({ type: "move", san: move.san, from: move.from, to: move.to, fen: game.fen() });
      if (data.sessionId) {
        void reportStudentBoard({
          data: { token: tokenFromPath(), label: label.current, fen: game.fen(), movesMade: count },
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: config?.orientation ?? "white",
          allowDragging: interactive,
          onPieceDrop,
        }}
      />
      {config?.show_controls !== false && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{locked ? "View only" : interactive ? "Your move" : "Read only"}</span>
          <button
            onClick={() => {
              setFen(data.fen);
              setMoves(0);
              post({ type: "reset", fen: data.fen });
            }}
            className="rounded-md border border-input px-2 py-1 hover:bg-accent"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function tokenFromPath() {
  const parts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
  return parts[parts.length - 1] ?? "";
}

/* ---------------------------------- Puzzle -------------------------------------- */

type PuzzlePayload = Extract<Awaited<ReturnType<typeof getEmbedPayload>>, { kind: "puzzle" }>;

function PuzzleWidget({ payload }: { payload: PuzzlePayload }) {
  const { config, data } = payload;
  const puzzle = data.puzzle;
  const [fen, setFen] = useState(puzzle.fen);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"solving" | "solved" | "wrong">("solving");

  const orientation = useMemo(() => {
    const turn = puzzle.fen.split(" ")[1];
    return turn === "w" ? "white" : "black";
  }, [puzzle.fen]);

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (status !== "solving" || !targetSquare) return false;
    const expected = puzzle.solution[step];
    const attempt = `${sourceSquare}${targetSquare}`;
    if (!expected || !expected.startsWith(attempt)) {
      setStatus("wrong");
      post({ type: "puzzle_result", solved: false });
      return false;
    }
    const game = new Chess(fen);
    game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    let nextStep = step + 1;
    const reply = puzzle.solution[nextStep];
    if (reply) {
      game.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: "q" });
      nextStep += 1;
    }
    setFen(game.fen());
    setStep(nextStep);
    if (nextStep >= puzzle.solution.length) {
      setStatus("solved");
      post({ type: "puzzle_result", solved: true });
    }
    return true;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Puzzle · {puzzle.rating}</span>
        <span className={status === "solved" ? "text-primary" : status === "wrong" ? "text-destructive" : ""}>
          {status === "solved" ? "Solved!" : status === "wrong" ? "Not the move" : `${orientation === "white" ? "White" : "Black"} to play`}
        </span>
      </div>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: config?.orientation ?? orientation,
          allowDragging: status === "solving",
          onPieceDrop,
        }}
      />
      {config?.show_controls !== false && (
        <button
          onClick={() => {
            setFen(puzzle.fen);
            setStep(0);
            setStatus("solving");
          }}
          className="mt-2 w-full rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* -------------------------------- Leaderboard ----------------------------------- */

type LeaderboardPayload = Extract<Awaited<ReturnType<typeof getEmbedPayload>>, { kind: "leaderboard" }>;

function LeaderboardWidget({ payload }: { payload: LeaderboardPayload }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-right">Rating</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Games</th>
          </tr>
        </thead>
        <tbody>
          {payload.data.players.map((p, i) => (
            <tr key={p.id} className="border-t border-border">
              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-foreground">{p.username}</td>
              <td className="px-3 py-2 text-right font-mono">{p.rating}</td>
              <td className="hidden px-3 py-2 text-right text-muted-foreground sm:table-cell">{p.games_played}</td>
            </tr>
          ))}
          {payload.data.players.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                No members yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------- Live game ------------------------------------ */

type GamePayload = Extract<Awaited<ReturnType<typeof getEmbedPayload>>, { kind: "game" }>;

function GameWidget({ payload }: { payload: GamePayload }) {
  const { config, data } = payload;
  const [fen, setFen] = useState(data.game.fen);

  useEffect(() => {
    const channel = supabase
      .channel(`embed-game:${data.game.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${data.game.id}` },
        (msg) => {
          const next = (msg.new as { fen?: string })?.fen;
          if (next) {
            setFen(next);
            post({ type: "position", fen: next });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data.game.id]);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{data.game.black?.username ?? "Black"}</span>
        <span>{data.game.timeControl}</span>
      </div>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: config?.orientation ?? "white",
          allowDragging: false,
        }}
      />
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{data.game.white?.username ?? "White"}</span>
        <span>{data.game.status === "completed" ? `Result: ${data.game.result ?? "—"}` : "Live"}</span>
      </div>
    </div>
  );
}
