import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { submitMove, resignGame } from "@/lib/matchmaking.functions";
import {
  offerDraw, respondDraw, abortGame,
  requestTakeback, respondTakeback,
  offerRematch, acceptRematch, checkFlag,
} from "@/lib/game-actions.functions";
import {
  heartbeat, markDisconnected, reconnect, claimDisconnectWin,
} from "@/lib/presence.functions";
import { sounds } from "@/lib/chess-sounds";
import { useGameClock, formatClock } from "@/hooks/useGameClock";
import { usePremoves } from "@/hooks/usePremoves";
import { GameActionBar } from "@/components/chess/GameActionBar";
import { OfferBanner } from "@/components/chess/OfferBanner";
import { DisconnectBanner } from "@/components/chess/DisconnectBanner";

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
  variant: string;
  chess960_start_fen: string | null;
  time_white_ms: number | null;
  time_black_ms: number | null;
  last_clock_update: string | null;
  initial_sec: number | null;
  increment_sec: number | null;
  draw_offer_by: string | null;
  draw_offer_at: string | null;
  takeback_offer_by: string | null;
  takeback_offer_at: string | null;
  rated: boolean;
};

type ProfileLite = { id: string; username: string; rating: number };

export const Route = createFileRoute("/play/$gameId")({
  head: () => ({ meta: [{ title: "Game — Hamduk Chess" }] }),
  component: PlayPage,
});

function PlayPage() {
  const { gameId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const submit = useServerFn(submitMove);
  const resign = useServerFn(resignGame);
  const draw = useServerFn(offerDraw);
  const drawRespond = useServerFn(respondDraw);
  const abort = useServerFn(abortGame);
  const tbReq = useServerFn(requestTakeback);
  const tbResp = useServerFn(respondTakeback);
  const rematchOffer = useServerFn(offerRematch);
  const rematchAccept = useServerFn(acceptRematch);
  const flagCheck = useServerFn(checkFlag);
  const beat = useServerFn(heartbeat);
  const disconnect = useServerFn(markDisconnected);
  const reconnectFn = useServerFn(reconnect);
  const claimWin = useServerFn(claimDisconnectWin);

  const [game, setGame] = useState<GameRow | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [submitting, setSubmitting] = useState(false);
  const [opponentDisconnectedAt, setOpponentDisconnectedAt] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);
  const premoves = usePremoves(3);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  // Initial load + game realtime
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.from("games").select("*").eq("id", gameId).single();
      if (cancelled) return;
      if (error || !data) { toast.error("Game not found"); navigate({ to: "/lobby" }); return; }
      setGame(data as GameRow);
      const { data: profs } = await supabase.from("profiles").select("id, username, rating").in("id", [data.white_id, data.black_id]);
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` }, (payload) => {
        const ev = payload.new as { type: string; by_user: string | null; payload: Record<string, unknown> };
        if (ev.type === "disconnect" && ev.by_user && ev.by_user !== user?.id) {
          setOpponentDisconnectedAt(new Date().toISOString());
        }
        if (ev.type === "reconnect" && ev.by_user && ev.by_user !== user?.id) {
          setOpponentDisconnectedAt(null);
        }
        if (ev.type === "rematch_offer" && ev.by_user && ev.by_user !== user?.id) {
          setRematchPending(true);
        }
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [gameId, navigate, user?.id]);

  // Presence heartbeat
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = () => { if (alive && document.visibilityState === "visible") void beat({}); };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [user, beat]);

  // Disconnect tracking
  useEffect(() => {
    if (!user || !game || game.status !== "active") return;
    const isParticipant = user.id === game.white_id || user.id === game.black_id;
    if (!isParticipant) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") void disconnect({ data: { gameId } });
      else void reconnectFn({ data: { gameId } });
    };
    const onBeforeUnload = () => { void disconnect({ data: { gameId } }); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [user, game, gameId, disconnect, reconnectFn]);

  const chess = useMemo(() => {
    if (!game) return null;
    const c = new Chess(game.chess960_start_fen ?? undefined);
    try { if (game.pgn) c.loadPgn(game.pgn); else c.load(game.fen); }
    catch { c.load(game.fen); }
    return c;
  }, [game]);

  const turn: "w" | "b" = chess?.turn() ?? "w";
  const isWhite = !!user && !!game && user.id === game.white_id;
  const isBlack = !!user && !!game && user.id === game.black_id;
  const isParticipant = isWhite || isBlack;
  const myColor: "w" | "b" | null = isWhite ? "w" : isBlack ? "b" : null;
  const myTurn = myColor !== null && myColor === turn && game?.status === "active";

  const { whiteDisplayMs, blackDisplayMs } = useGameClock({
    whiteMs: game?.time_white_ms ?? 0,
    blackMs: game?.time_black_ms ?? 0,
    turn,
    lastUpdate: game?.last_clock_update ?? null,
    active: game?.status === "active",
  });

  // Auto-flag check when displayed clock hits 0 for opponent
  const flaggedRef = useRef(false);
  useEffect(() => {
    if (!game || game.status !== "active" || flaggedRef.current) return;
    const oppMs = myColor === "w" ? blackDisplayMs : whiteDisplayMs;
    if (oppMs <= 0 && game.ply >= 2 && !myTurn) {
      flaggedRef.current = true;
      void flagCheck({ data: { gameId } }).catch(() => { flaggedRef.current = false; });
    }
  }, [game, myColor, whiteDisplayMs, blackDisplayMs, myTurn, gameId, flagCheck]);

  // Try premove after opponent moves
  useEffect(() => {
    if (!game || game.status !== "active" || !myTurn) return;
    const next = premoves.consumeIfLegal(game.fen);
    if (next) {
      const uci = `${next.from}${next.to}${next.promotion ?? ""}`;
      setSubmitting(true);
      void submit({ data: { gameId, uci } })
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Premove rejected"))
        .finally(() => setSubmitting(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.fen, myTurn]);

  if (loading || !user || !game || !chess) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const orientation: "white" | "black" = isBlack ? "black" : "white";
  const opponent = isWhite ? profiles[game.black_id] : profiles[game.white_id];
  const me = profiles[user.id];

  function handleDrop({ sourceSquare, targetSquare, piece }: { sourceSquare: string; targetSquare: string | null; piece: { pieceType: string } }): boolean {
    if (!targetSquare || !game) return false;
    const from = sourceSquare as Square;
    const to = targetSquare as Square;
    const isPromo = piece.pieceType.toLowerCase().endsWith("p") &&
      ((myColor === "w" && to[1] === "8") || (myColor === "b" && to[1] === "1"));

    if (!myTurn) {
      // Premove path: validate against a hypothetical position by trusting the piece type
      if (!myColor) return false;
      premoves.enqueue({ from, to, promotion: isPromo ? "q" : undefined });
      return true;
    }

    if (submitting) return false;
    const probe = new Chess(chess!.fen());
    let legal;
    try { legal = probe.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!legal) return false;
    const uci = `${from}${to}${isPromo ? "q" : ""}`;
    setSubmitting(true);
    void submit({ data: { gameId, uci } })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Move rejected"))
      .finally(() => setSubmitting(false));
    return true;
  }

  async function handleResign() {
    if (!confirm("Resign this game?")) return;
    try { await resign({ data: { gameId } }); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function handleOfferDraw() {
    try { await draw({ data: { gameId } }); toast.success("Draw offered"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function handleAbort() {
    try { await abort({ data: { gameId } }); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function handleRequestTakeback() {
    try { await tbReq({ data: { gameId } }); toast.success("Takeback requested"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function handleOfferRematch() {
    try { await rematchOffer({ data: { gameId } }); toast.success("Rematch offered"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function handleAcceptRematch() {
    try {
      const { gameId: newId } = await rematchAccept({ data: { gameId } });
      navigate({ to: "/play/$gameId", params: { gameId: newId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const incomingDraw = game.draw_offer_by && game.draw_offer_by !== user.id && game.draw_offer_at;
  const outgoingDraw = game.draw_offer_by === user.id;
  const incomingTb = game.takeback_offer_by && game.takeback_offer_by !== user.id && game.takeback_offer_at;
  const outgoingTb = game.takeback_offer_by === user.id;

  const customArrows = premoves.queue.map((p, i) => ({
    startSquare: p.from, endSquare: p.to,
    color: `rgba(245, 166, 35, ${0.5 - i * 0.1})`,
  }));

  const statusText = game.status === "completed"
    ? game.result === "draw"
      ? `Draw by ${game.end_reason ?? "agreement"}`
      : `${game.result === "white" ? profiles[game.white_id]?.username ?? "White" : profiles[game.black_id]?.username ?? "Black"} won by ${game.end_reason ?? "resignation"}`
    : myTurn ? "Your turn" : isParticipant ? "Opponent's turn" : "Spectating";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Link to="/lobby" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to lobby</Link>
          <PlayerStrip
            profile={opponent}
            color={isWhite ? "Black" : "White"}
            active={!myTurn && game.status === "active"}
            clockMs={isWhite ? blackDisplayMs : whiteDisplayMs}
          />
          <div className="my-2 aspect-square w-full max-w-[640px]">
            <Chessboard
              options={{
                position: chess.fen(),
                onPieceDrop: handleDrop,
                boardOrientation: orientation,
                allowDragging: isParticipant && game.status === "active",
                animationDurationInMs: 200,
                id: `game-${gameId}`,
                arrows: customArrows,
              }}
            />
          </div>
          <PlayerStrip
            profile={me}
            color={isWhite ? "White" : "Black"}
            active={myTurn}
            you
            clockMs={isWhite ? whiteDisplayMs : blackDisplayMs}
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{game.time_control} · {game.variant}</p>
              {!game.rated && <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">Casual</span>}
            </div>
            <p className="mt-1 font-serif text-lg font-bold">{statusText}</p>

            {incomingDraw && (
              <OfferBanner
                kind="draw"
                offeredAt={game.draw_offer_at!}
                onAccept={() => drawRespond({ data: { gameId, accept: true } })}
                onDecline={() => drawRespond({ data: { gameId, accept: false } })}
              />
            )}
            {incomingTb && (
              <OfferBanner
                kind="takeback"
                offeredAt={game.takeback_offer_at!}
                onAccept={() => tbResp({ data: { gameId, accept: true } })}
                onDecline={() => tbResp({ data: { gameId, accept: false } })}
              />
            )}
            {opponentDisconnectedAt && game.status === "active" && (
              <DisconnectBanner
                disconnectedAt={opponentDisconnectedAt}
                onClaimWin={() => { void claimWin({ data: { gameId } }); }}
              />
            )}
            {rematchPending && game.status === "completed" && (
              <div className="my-3 flex items-center justify-between rounded-lg border border-primary bg-primary/5 px-4 py-3">
                <p className="font-semibold">Rematch offered</p>
                <button onClick={handleAcceptRematch} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Accept</button>
              </div>
            )}

            <div className="mt-3">
              <GameActionBar
                status={game.status}
                ply={game.ply}
                rated={game.rated}
                isParticipant={isParticipant}
                onResign={handleResign}
                onOfferDraw={handleOfferDraw}
                onAbort={handleAbort}
                onRequestTakeback={handleRequestTakeback}
                onOfferRematch={handleOfferRematch}
                drawOfferOutgoing={!!outgoingDraw}
                takebackOfferOutgoing={!!outgoingTb}
              />
            </div>
            {premoves.queue.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{premoves.queue.length} premove(s) queued — <button onClick={premoves.clear} className="underline hover:text-foreground">clear</button></p>
            )}
          </div>

          <MoveHistory chess={chess} />
        </aside>
      </main>
    </div>
  );
}

function PlayerStrip({ profile, color, active, you, clockMs }: { profile?: ProfileLite; color: string; active: boolean; you?: boolean; clockMs: number }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${active ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
        <div>
          <p className="text-sm font-semibold">{profile?.username ?? "—"} {you && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}</p>
          <p className="text-xs text-muted-foreground">{color} · {profile?.rating ?? "—"}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"} ${clockMs < 10_000 ? "text-destructive" : ""}`}>
        <Clock className="h-4 w-4" />
        {formatClock(clockMs)}
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
