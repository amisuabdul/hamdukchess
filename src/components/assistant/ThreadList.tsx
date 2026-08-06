import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createThread, deleteThread, listThreads } from "@/lib/assistant.functions";

export function ThreadList({ activeThreadId }: { activeThreadId?: string }) {
  const fetchThreads = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["assistant-threads"],
    queryFn: () => fetchThreads(),
  });

  const newThread = useMutation({
    mutationFn: () => create({ data: {} }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["assistant-threads"] });
      if (res.thread?.id) navigate({ to: "/assistant/$threadId", params: { threadId: res.thread.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (threadId: string) => remove({ data: { threadId } }),
    onSuccess: async (_r, threadId) => {
      await qc.invalidateQueries({ queryKey: ["assistant-threads"] });
      if (threadId === activeThreadId) navigate({ to: "/assistant" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const threads = data?.threads ?? [];

  return (
    <div className="flex h-full flex-col gap-2">
      <button
        onClick={() => newThread.mutate()}
        disabled={newThread.isPending}
        className="mx-2 mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> New conversation
      </button>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {threads.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">No conversations yet.</p>
        )}
        {threads.map((t) => (
          <div
            key={t.id}
            className={`group flex items-center gap-1 rounded-md px-1 ${
              t.id === activeThreadId ? "bg-accent" : "hover:bg-accent/60"
            }`}
          >
            <Link
              to="/assistant/$threadId"
              params={{ threadId: t.id }}
              className={`flex-1 truncate px-2 py-2 text-sm ${
                t.id === activeThreadId ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              {t.title}
            </Link>
            <button
              onClick={() => del.mutate(t.id)}
              aria-label={`Delete ${t.title}`}
              className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
