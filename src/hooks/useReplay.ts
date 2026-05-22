import { useCallback, useMemo, useState } from "react";
import { Chess, type Move } from "chess.js";
import { startFen } from "@/lib/fen";
import { loadPgn } from "@/lib/pgn";

export type ReplayState = {
  startFen: string;
  headers: Record<string, string>;
  moves: Move[];
  ply: number; // 0 = start position, N = after Nth move
};

const EMPTY: ReplayState = { startFen, headers: {}, moves: [], ply: 0 };

export function useReplay() {
  const [state, setState] = useState<ReplayState>(EMPTY);

  const currentChess = useMemo(() => {
    const c = new Chess(state.startFen);
    for (let i = 0; i < state.ply; i++) {
      const m = state.moves[i];
      c.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    return c;
  }, [state]);

  const fen = currentChess.fen();
  const turn = currentChess.turn();

  const setPly = useCallback((p: number) => {
    setState((s) => ({ ...s, ply: Math.max(0, Math.min(s.moves.length, p)) }));
  }, []);

  const next = useCallback(() => setPly(state.ply + 1), [setPly, state.ply]);
  const prev = useCallback(() => setPly(state.ply - 1), [setPly, state.ply]);
  const toStart = useCallback(() => setPly(0), [setPly]);
  const toEnd = useCallback(() => setPly(state.moves.length), [setPly, state.moves.length]);

  const loadPgnText = useCallback((pgn: string) => {
    const loaded = loadPgn(pgn);
    setState({
      startFen,
      headers: loaded.headers,
      moves: loaded.moves,
      ply: loaded.moves.length,
    });
  }, []);

  const loadFenText = useCallback((fenStr: string) => {
    const trimmed = fenStr.trim();
    new Chess(trimmed); // throws if invalid
    setState({ startFen: trimmed, headers: {}, moves: [], ply: 0 });
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  return {
    ...state,
    fen,
    turn,
    isStart: state.ply === 0,
    isEnd: state.ply === state.moves.length,
    setPly,
    next,
    prev,
    toStart,
    toEnd,
    loadPgnText,
    loadFenText,
    reset,
  };
}
