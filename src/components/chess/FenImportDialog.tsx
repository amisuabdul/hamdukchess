import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (fen: string) => void;
};

export function FenImportDialog({ open, onOpenChange, onLoad }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    try {
      onLoad(text);
      setText("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid FEN");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import FEN</DialogTitle>
        </DialogHeader>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          className="w-full rounded-md border border-zinc-300 bg-white p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="py-2 px-3 text-sm font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="py-2 px-3 text-sm font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800"
          >
            Load FEN
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
