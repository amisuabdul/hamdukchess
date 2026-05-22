import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (pgn: string) => void;
};

export function PgnImportDialog({ open, onOpenChange, onLoad }: Props) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!text.trim()) return;
    try {
      onLoad(text);
      setText("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid PGN");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import PGN</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'[Event "Casual"]\n[White "Player 1"]\n[Black "Player 2"]\n\n1. e4 e5 2. Nf3 Nc6 ...'}
            className="w-full h-56 rounded-md border border-zinc-300 bg-white p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pgn,text/plain"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const content = await file.text();
                setText(content);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
            >
              …or upload a .pgn file
            </button>
          </div>
        </div>
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
            Load PGN
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
