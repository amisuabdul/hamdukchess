type Props = {
  onImportPgn: () => void;
  onImportFen: () => void;
  onExportPgn: () => void;
  onCopyFen: () => void;
  onFlip: () => void;
  onReset: () => void;
  hasMoves: boolean;
};

export function AnalysisToolbar({
  onImportPgn,
  onImportFen,
  onExportPgn,
  onCopyFen,
  onFlip,
  onReset,
  hasMoves,
}: Props) {
  const btn =
    "py-2 px-3 text-xs font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onImportPgn} className={btn}>Import PGN</button>
      <button onClick={onImportFen} className={btn}>Import FEN</button>
      <button onClick={onExportPgn} disabled={!hasMoves} className={btn}>Export PGN</button>
      <button onClick={onCopyFen} className={btn}>Copy FEN</button>
      <button onClick={onFlip} className={btn}>Flip</button>
      <button onClick={onReset} className={btn}>Reset</button>
    </div>
  );
}
