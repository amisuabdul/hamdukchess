import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { toast } from "sonner";
import {
  ArrowLeft, Camera, Download, Globe, Link2, Lock, Send, Trash2, UserPlus, Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteSnapshot,
  getStudyMeta,
  inviteCollaborator,
  postStudyMessage,
  removeCollaborator,
  saveSnapshot,
  setStudyVisibility,
  updateStudyState,
} from "@/lib/study.functions";

export const Route = createFileRoute("/study/$studyId")({
  head: () => ({
    meta: [
      { title: "Shared Study Board — Hamduk Chess" },
      {
        name: "description",
        content:
          "Collaborate on a chess position in real time: move pieces together, draw arrows, annotate moves, save snapshots and export PGN with comments.",
      },
      { property: "og:title", content: "Shared Study Board — Hamduk Chess" },
      {
        property: "og:description",
        content: "Real-time collaborative chess study board with arrows, annotations and PGN export.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyBoardPage,
});

type Board = {
  id: string;
  title: string;
  owner_id: string;
  collaborators: string[] | null;
  visibility: string;
  start_fen: string;
  current_pgn: string;
  annotations: Record<string, string> | null;
  shapes: Record<string, string[]> | null;
};

type ChatRow = { id: string; user_id: string; content: string; created_at: string };
type Snapshot = { id: string; name: string; created_at: string; data: { fen: string; pgn: string; comment: string | null } };

function StudyBoardPage() {
  const { studyId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const saveState = useServerFn(updateStudyState);
  const snapshot = useServerFn(saveSnapshot);
  const dropSnapshot = useServerFn(deleteSnapshot);
  const invite = useServerFn(inviteCollaborator);
  const kick = useServerFn(removeCollaborator);
  const setVis = useServerFn(setStudyVisibility);
  const sendMsg = useServerFn(postStudyMessage);
  const fetchMeta = useServerFn(getStudyMeta);

  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [inviteName, setInviteName] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [viewers, setViewers] = useState(1);
  const localEdit = useRef(0);

  const board = useQuery({
    queryKey: ["study", studyId],
    queryFn: async (): Promise<Board> => {
      const { data, error } = await supabase
        .from("study_boards")
        .select("id, title, owner_id, collaborators, visibility, start_fen, current_pgn, annotations, shapes")
        .eq("id", studyId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Study not found or not shared with you");
      return data as Board;
    },
  });

  const meta = useQuery({
    queryKey: ["study-meta", studyId],
    queryFn: async () => fetchMeta({ data: { studyId } }),
  });

  const chat = useQuery({
    queryKey: ["study-chat", studyId],
    queryFn: async (): Promise<ChatRow[]> => {
      const { data } = await supabase
        .from("study_chat")
        .select("id, user_id, content, created_at")
        .eq("board_id", studyId)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as ChatRow[];
    },
  });

  const snapshots = useQuery({
    queryKey: ["study-snapshots", studyId],
    queryFn: async (): Promise<Snapshot[]> => {
      const { data } = await supabase
        .from("study_snapshots")
        .select("id, name, created_at, data")
        .eq("board_id", studyId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Snapshot[];
    },
  });

  // Real-time collaboration on channel study:{id}
  useEffect(() => {
    const channel = supabase
      .channel(`study:${studyId}`, { config: { presence: { key: user?.id ?? crypto.randomUUID() } } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "study_boards", filter: `id=eq.${studyId}` },
        () => {
          // Ignore echoes of our own very recent write to avoid board flicker mid-drag.
          if (Date.now() - localEdit.current < 600) return;
          qc.invalidateQueries({ queryKey: ["study", studyId] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "study_chat", filter: `board_id=eq.${studyId}` },
        () => qc.invalidateQueries({ queryKey: ["study-chat", studyId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "study_snapshots", filter: `board_id=eq.${studyId}` },
        () => qc.invalidateQueries({ queryKey: ["study-snapshots", studyId] }))
      .on("presence", { event: "sync" }, () => {
        setViewers(Object.keys(channel.presenceState()).length || 1);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });
    return () => { void supabase.removeChannel(channel); };
  }, [studyId, user?.id, qc]);

  const data = board.data;
  const chess = useMemo(() => {
    const c = new Chess(data?.start_fen || undefined);
    if (data?.current_pgn) {
      try { c.loadPgn(data.current_pgn, { strict: false }); } catch { /* keep start position */ }
    }
    return c;
  }, [data?.start_fen, data?.current_pgn]);

  const canEdit = !!user && !!data && (data.owner_id === user.id || (data.collaborators ?? []).includes(user.id));
  const isOwner = !!user && data?.owner_id === user.id;
  const history = chess.history();
  const currentPly = String(history.length);
  const annotations = data?.annotations ?? {};
  const shapes = data?.shapes ?? {};

  useEffect(() => { setNote(annotations[currentPly] ?? ""); }, [currentPly, data?.annotations]);

  const push = useMutation({
    mutationFn: async (payload: { pgn: string; annotations?: Record<string, string>; shapes?: Record<string, string[]> }) => {
      localEdit.current = Date.now();
      return saveState({ data: { studyId, ...payload } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study", studyId] }),
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["study", studyId] });
      toast.error(e instanceof Error ? e.message : "Could not sync move");
    },
  });

  const handleDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!canEdit || !targetSquare) return false;
      const probe = new Chess(chess.fen());
      try {
        const mv = probe.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (!mv) return false;
      } catch { return false; }
      const next = new Chess(data?.start_fen || undefined);
      try { if (data?.current_pgn) next.loadPgn(data.current_pgn, { strict: false }); } catch { /* noop */ }
      try { next.move({ from: sourceSquare, to: targetSquare, promotion: "q" }); } catch { return false; }
      push.mutate({ pgn: next.pgn() });
      return true;
    },
    [canEdit, chess, data?.start_fen, data?.current_pgn, push],
  );

  function undoMove() {
    if (!canEdit) return;
    const next = new Chess(data?.start_fen || undefined);
    try { if (data?.current_pgn) next.loadPgn(data.current_pgn, { strict: false }); } catch { /* noop */ }
    next.undo();
    push.mutate({ pgn: next.pgn() });
  }

  function toggleShape(square: string) {
    if (!canEdit) return;
    if (!selected) { setSelected(square); return; }
    const key = currentPly;
    const token = selected === square ? square : `${selected}${square}`;
    const list = shapes[key] ?? [];
    const nextList = list.includes(token) ? list.filter((t) => t !== token) : [...list, token];
    setSelected(null);
    push.mutate({ pgn: data?.current_pgn ?? "", shapes: { ...shapes, [key]: nextList } });
  }

  function saveNote() {
    if (!canEdit) return;
    push.mutate({
      pgn: data?.current_pgn ?? "",
      annotations: { ...annotations, [currentPly]: note.trim() },
    });
    toast.success("Annotation saved");
  }

  function exportPgn() {
    const out = new Chess(data?.start_fen || undefined);
    const moves = chess.history({ verbose: true });
    if (annotations["0"]) out.setComment(annotations["0"]);
    moves.forEach((m, i) => {
      out.move({ from: m.from, to: m.to, promotion: m.promotion });
      const c = annotations[String(i + 1)];
      if (c) out.setComment(c);
    });
    out.setHeader("Event", data?.title ?? "Hamduk study");
    const blob = new Blob([out.pgn({ maxWidth: 80, newline: "\n" })], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data?.title ?? "study").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const shapeTokens = shapes[currentPly] ?? [];
  const arrows = shapeTokens
    .filter((t) => t.length === 4)
    .map((t) => ({ startSquare: t.slice(0, 2), endSquare: t.slice(2, 4), color: "hsl(43 74% 49%)" }));
  const squareStyles = useMemo(() => {
    const styles: Record<string, Record<string, string>> = {};
    shapeTokens.filter((t) => t.length === 2).forEach((sq) => {
      styles[sq] = { background: "radial-gradient(circle, hsl(43 74% 49% / 0.55) 60%, transparent 62%)" };
    });
    if (selected) styles[selected] = { boxShadow: "inset 0 0 0 3px hsl(43 74% 49%)" };
    return styles;
  }, [shapeTokens, selected]);

  if (board.isLoading) return <main className="p-8 text-sm text-muted-foreground">Loading study…</main>;
  if (board.error || !data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Study unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This study is private or the link is wrong. Ask the owner to add you as a collaborator.
        </p>
        <Link to="/study" className="mt-4 inline-block text-sm text-primary">Back to studies</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_340px]">
      <div>
        <Link to="/study" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All studies
        </Link>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-bold">{data.title}</h1>
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
            {data.visibility === "public" ? <Globe className="h-3 w-3" /> : data.visibility === "shared" ? <Link2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {data.visibility}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {viewers} online
          </span>
          {!canEdit && <span className="text-xs text-muted-foreground">View only</span>}
        </div>

        <div className="aspect-square w-full max-w-[640px]">
          <Chessboard
            options={{
              position: chess.fen(),
              onPieceDrop: handleDrop,
              onSquareClick: ({ square }: { square: string }) => toggleShape(square),
              boardOrientation: orientation,
              allowDragging: canEdit,
              animationDurationInMs: 180,
              id: `study-${studyId}`,
              arrows,
              squareStyles,
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
            className="rounded-lg border border-border px-3 py-1.5 text-sm">Flip board</button>
          <button onClick={undoMove} disabled={!canEdit || history.length === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40">Undo move</button>
          <button onClick={exportPgn} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
            <Download className="h-4 w-4" /> Export PGN
          </button>
          <button
            onClick={() => {
              const name = window.prompt("Snapshot name", `Move ${history.length}`);
              if (!name) return;
              snapshot({ data: { studyId, name, fen: chess.fen(), pgn: chess.pgn(), comment: note || undefined } })
                .then(() => { toast.success("Snapshot saved"); qc.invalidateQueries({ queryKey: ["study-snapshots", studyId] }); })
                .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
            }}
            disabled={!canEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            <Camera className="h-4 w-4" /> Snapshot
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Click a square then another to draw an arrow; click the same square twice to highlight it.
        </p>

        <div className="mt-4 rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Annotation after move {history.length}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 2000))}
            disabled={!canEdit}
            rows={3}
            placeholder="Comment on this position…"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button onClick={saveNote} disabled={!canEdit}
            className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            Save annotation
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moves</p>
          <p className="mt-2 font-mono text-sm leading-relaxed">
            {history.length === 0 ? "—" : history.map((san, i) => (
              <span key={i} className={annotations[String(i + 1)] ? "text-primary" : undefined}>
                {i % 2 === 0 ? `${i / 2 + 1}. ` : ""}{san}{" "}
              </span>
            ))}
          </p>
        </div>
      </div>

      <aside className="space-y-4">
        {isOwner && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visibility</p>
            <select
              value={data.visibility}
              onChange={(e) =>
                setVis({ data: { studyId, visibility: e.target.value as "private" | "shared" | "public" } })
                  .then(() => qc.invalidateQueries({ queryKey: ["study", studyId] }))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"))
              }
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="private">Private — only me</option>
              <option value="shared">Shared — anyone with the link</option>
              <option value="public">Public — listed and viewable</option>
            </select>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collaborators</p>
          <ul className="mt-2 space-y-1 text-sm">
            {meta.data?.people.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>{p.username}{p.isOwner && <span className="ml-1 text-xs text-muted-foreground">owner</span>}</span>
                {isOwner && !p.isOwner && (
                  <button
                    aria-label={`Remove ${p.username}`}
                    onClick={() =>
                      kick({ data: { studyId, userId: p.id } })
                        .then(() => { qc.invalidateQueries({ queryKey: ["study-meta", studyId] }); qc.invalidateQueries({ queryKey: ["study", studyId] }); })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                    }
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteName.trim()) return;
                invite({ data: { studyId, username: inviteName.trim() } })
                  .then((r) => {
                    toast.success(`${r.username} can now edit this study`);
                    setInviteName("");
                    qc.invalidateQueries({ queryKey: ["study-meta", studyId] });
                    qc.invalidateQueries({ queryKey: ["study", studyId] });
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
              }}
            >
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="username"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
              <button className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                <UserPlus className="h-4 w-4" /> Invite
              </button>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snapshots</p>
          <ul className="mt-2 space-y-1 text-sm">
            {snapshots.data?.length === 0 && <li className="text-muted-foreground">No snapshots yet.</li>}
            {snapshots.data?.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <button
                  className="min-w-0 flex-1 truncate text-left hover:text-primary"
                  onClick={() => canEdit && push.mutate({ pgn: s.data.pgn })}
                  title={s.data.fen}
                >
                  {s.name}
                </button>
                {canEdit && (
                  <button
                    aria-label={`Delete snapshot ${s.name}`}
                    onClick={() =>
                      dropSnapshot({ data: { snapshotId: s.id } })
                        .then(() => qc.invalidateQueries({ queryKey: ["study-snapshots", studyId] }))
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
                    }
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex h-80 flex-col rounded-xl border border-border bg-card">
          <p className="border-b border-border p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Study chat
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {chat.data?.map((m) => {
              const who = meta.data?.people.find((p) => p.id === m.user_id)?.username ?? "player";
              return (
                <p key={m.id}>
                  <span className="font-semibold">{who}: </span>
                  <span className="text-muted-foreground">{m.content}</span>
                </p>
              );
            })}
            {chat.data?.length === 0 && <p className="text-muted-foreground">No messages yet.</p>}
          </div>
          {canEdit && (
            <form
              className="flex gap-2 border-t border-border p-2"
              onSubmit={(e) => {
                e.preventDefault();
                const content = draft.trim();
                if (!content) return;
                setDraft("");
                sendMsg({ data: { studyId, content } })
                  .then(() => qc.invalidateQueries({ queryKey: ["study-chat", studyId] }))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                placeholder="Message collaborators…"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
              <button className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" aria-label="Send message">
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </aside>
    </main>
  );
}
