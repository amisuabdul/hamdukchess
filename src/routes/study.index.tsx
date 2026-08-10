import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, BookOpen, Globe, Link2, Lock, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { createStudy, deleteStudy } from "@/lib/study.functions";

export const Route = createFileRoute("/study/")({
  head: () => ({
    meta: [
      { title: "Study Boards — Collaborative Chess Analysis | Hamduk Chess" },
      {
        name: "description",
        content:
          "Create shared study boards, invite collaborators by username and analyse positions together in real time with arrows, annotations and snapshots.",
      },
      { property: "og:title", content: "Study Boards — Collaborative Chess Analysis" },
      {
        property: "og:description",
        content: "Real-time collaborative chess study boards with annotations, snapshots and PGN export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyIndexPage,
});

type BoardRow = {
  id: string;
  title: string;
  owner_id: string;
  visibility: string;
  current_fen: string;
  updated_at: string;
};

const VIS_ICON = { private: Lock, shared: Link2, public: Globe } as const;

function StudyIndexPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createStudy);
  const remove = useServerFn(deleteStudy);
  const [title, setTitle] = useState("");
  const [pgn, setPgn] = useState("");
  const [fen, setFen] = useState("");

  const studies = useQuery({
    queryKey: ["studies", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await supabase
        .from("study_boards")
        .select("id, title, owner_id, visibility, current_fen, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as BoardRow[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () =>
      create({
        data: {
          title: title.trim() || "Untitled study",
          startPgn: pgn.trim() || undefined,
          startFen: fen.trim() || undefined,
        },
      }),
    onSuccess: (r) => navigate({ to: "/study/$studyId", params: { studyId: r.studyId } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create study"),
  });

  const deleteMut = useMutation({
    mutationFn: async (studyId: string) => remove({ data: { studyId } }),
    onSuccess: () => {
      toast.success("Study deleted");
      qc.invalidateQueries({ queryKey: ["studies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  if (!loading && !user) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        <p>Sign in to create and share study boards.</p>
        <Link to="/login" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-bold">Study boards</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Analyse together in real time — moves, arrows and annotations sync instantly for every collaborator.
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">New study</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Study title"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={fen}
            onChange={(e) => setFen(e.target.value.slice(0, 120))}
            placeholder="Starting FEN (optional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
        <textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value.slice(0, 20000))}
          placeholder="Paste PGN (optional)"
          rows={3}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Create study
        </button>
      </section>

      <section className="mt-8 space-y-2">
        {studies.isLoading && <p className="text-sm text-muted-foreground">Loading studies…</p>}
        {studies.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No studies yet. Create one above and invite a friend by username.
          </p>
        )}
        {studies.data?.map((s) => {
          const Icon = VIS_ICON[s.visibility as keyof typeof VIS_ICON] ?? Lock;
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <BookOpen className="h-5 w-5 shrink-0 text-primary" />
              <Link
                to="/study/$studyId"
                params={{ studyId: s.id }}
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Updated {new Date(s.updated_at).toLocaleString()}
                  {s.owner_id !== user?.id && " · shared with you"}
                </p>
              </Link>
              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                <Icon className="h-3 w-3" /> {s.visibility}
              </span>
              {s.owner_id === user?.id && (
                <button
                  onClick={() => deleteMut.mutate(s.id)}
                  aria-label={`Delete ${s.title}`}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
