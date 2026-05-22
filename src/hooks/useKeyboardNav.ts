import { useEffect } from "react";

type Handlers = {
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onEnd: () => void;
};

export function useKeyboardNav({ onPrev, onNext, onStart, onEnd }: Handlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          onPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          onNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          onStart();
          break;
        case "ArrowDown":
          e.preventDefault();
          onEnd();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext, onStart, onEnd]);
}
