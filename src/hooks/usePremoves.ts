import { useCallback, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";

export interface Premove {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
}

export function usePremoves(max = 3) {
  const [queue, setQueue] = useState<Premove[]>([]);
  const queueRef = useRef<Premove[]>([]);
  queueRef.current = queue;

  const enqueue = useCallback((p: Premove) => {
    setQueue((q) => (q.length >= max ? q : [...q, p]));
  }, [max]);

  const clear = useCallback(() => setQueue([]), []);

  /** Pop the first legal premove given the current fen. Returns it (or null). */
  const consumeIfLegal = useCallback((fen: string): Premove | null => {
    const q = queueRef.current;
    if (q.length === 0) return null;
    const [head, ...rest] = q;
    const chess = new Chess(fen);
    try {
      const m = chess.move({ from: head.from, to: head.to, promotion: head.promotion ?? "q" });
      if (m) {
        setQueue(rest);
        return head;
      }
    } catch { /* fall through */ }
    setQueue([]);
    return null;
  }, []);

  return { queue, enqueue, clear, consumeIfLegal };
}
