import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { Loader2, Flag, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { submitMove, resignGame } from "@/lib/matchmaking.functions";
import { sounds } from "@/lib/chess-sounds";

type GameRow = {
  id: string;
  white_id: string;
  black_id: string;
  fen: string;
  pgn: string;
  ply: number;
  status: string;
  result: string | null;
  end_reason: string | null;
  winner_id: string | null;
  time_control: string;
};

type ProfileLite = { id: string; username: string; rating: number };

export const Route = createFileRoute("/play/$gameId")({
  head: () => ({
    meta: [{ title: "Game — Hamduk Chess" }],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { gameId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const submit = useServerFn(submitMove);
  const resign = useServerFn(resignGame);
  const [game, setGame] = useState<GameRow | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Initial load + realtime subscription
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("games").select("*").eq("id", gameId).single();
      if (cancelled) return;
      if (error || !data) { toast.error("Game not found"); navigate({ to: "/lobby" }); return; }
      setGame(data as GameRow);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, rating")
        .in("id", [data.white_id, data.black_id]);
      if (profs) {
        const map: Record<string, ProfileLite> = {};
        for (const p of profs) map[p.id] = p as ProfileLite;
        setProfiles(map);
      }
    }
    void load();

    const channel = supabase
      .channel(`game:${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new as GameRow);
        sounds.move();
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [gameId, navigate]);

  const chess = useMemo(() => {
    if (!game) return null;
    const c = new Chess();
    try { if (game.pgn) c.loadPgn(game.pgn); else c.load(game.fen); }
    catch { c.load(game.fen); }
    return c;
  }, [game]);

  if (loading || !user || !game || !chess) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const isWhite = user.id === game.white_id;
  const isBlack = user.id === game.black_id;
  const isParticipant = isWhite || isBlack;
  const myColor: "w" | "b" | null = isWhite ? "w" : isBlack ? "b" : null;
  const orientation: "white" | "black" = isBlack ? "black" : "white";
  const turn = chess.turn();
  const myTurn = myColor !== null && myColor === turn && game.status === "active";

  const opponent = isWhite ? profiles[game.black_id] : profiles[game.white_id];
  const me = profiles[user.id];

  function handleDrop({ sourceSquare, targetSquare, piece }: { sourceSquare: string; targetSquare: string | null; piece: { pieceType: string } }): boolean {
    if (!myTurn || !targetSquare || submitting) return false;
    const from = sourceSquare as Square;
    const to = targetSquare as Square;
    // Locally validate first so the board doesn't snap back unnecessarily.
    const probe = new Chess(chess!.fen());
    const isPromo = piece.pieceType.toLowerCase().endsWith("p") &&
      ((myColor === "w" && to[1] === "8") || (myColor === "b" && to[1] === "1"));
    let legal;
    try { legal = probe.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!legal) return false;
    const uci = `${from}${to}${isPromo ? "q" : ""}`;
    setSubmitting(true);
    void submit({ data: { gameId, uci } })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Move rejected");
      })
      .finally(() => setSubmitting(false));
    return true;
  }

  async function handleResign() {
    if (!confirm("Resign this game?")) return;
    try { await resign({ data: { gameId } }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to resign"); }
  }

  const statusText = game.status === "completed"
    ? game.result === "draw"
      ? `Draw by ${game.end_reason ?? "agreement"}`
      : `${game.result === "white" ? profiles[game.white_id]?.username ?? "White" : profiles[game.black_id]?.username ?? "Black"} won by ${game.end_reason ?? "resignation"}`
    : myTurn ? "Your turn" : isParticipant ? "Opponent's turn" : "Spectating";

  return (
    <div className="min-h-screen bg-background">

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div>
          <Link to="/lobby" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to lobby</Link>
          <PlayerStrip profile={opponent} color={isWhite ? "Black" : "White"} active={!myTurn && game.status === "active"} />
          <div className="my-2 aspect-square w-full max-w-[640px]">
            <Chessboard
              options={{
                position: chess.fen(),
                onPieceDrop: handleDrop,
                boardOrientation: orientation,
                allowDragging: myTurn,
                animationDurationInMs: 200,
                id: `game-${gameId}`,
              }}
            />
          </div>
          <PlayerStrip profile={me} color={isWhite ? "White" : "Black"} active={myTurn} you />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{game.time_control}</p>
            <p className="mt-1 font-serif text-lg font-bold">{statusText}</p>
            {game.status === "active" && isParticipant && (
              <button
                onClick={handleResign}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                <Flag className="h-4 w-4" /> Resign
              </button>
            )}
            {game.status === "completed" && (
              <Link to="/lobby" className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                New game
              </Link>
            )}
          </div>

          <MoveHistory chess={chess} />
        </aside>
      </main>
    </div>
  );
}

function PlayerStrip({ profile, color, active, you }: { profile?: ProfileLite; color: string; active: boolean; you?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
        <div>
          <p className="text-sm font-semibold">{profile?.username ?? "—"} {you && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}</p>
          <p className="text-xs text-muted-foreground">{color} · {profile?.rating ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

function MoveHistory({ chess }: { chess: Chess }) {
  const history = chess.history();
  const rows: { num: number; w?: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ num: i / 2 + 1, w: history[i], b: history[i + 1] });
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moves</p>
      <div className="max-h-[400px] overflow-y-auto font-mono text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">No moves yet.</p>}
        {rows.map((r) => (
          <div key={r.num} className="flex gap-2 py-0.5">
            <span className="w-6 text-right text-muted-foreground">{r.num}.</span>
            <span className="w-16">{r.w}</span>
            <span className="w-16">{r.b ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
