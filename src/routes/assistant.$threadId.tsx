import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { Sparkles } from "lucide-react";
import { getThread } from "@/lib/assistant.functions";
import { ThreadList } from "@/components/assistant/ThreadList";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const Route = createFileRoute("/assistant/$threadId")({
  head: () => ({
    meta: [
      { title: "Coach chat — Hamduk Chess AI Assistant" },
      {
        name: "description",
        content:
          "Your saved conversation with the Hamduk Chess AI coach: game reviews, mistake explanations and training advice.",
      },
      { property: "og:title", content: "Coach chat — Hamduk Chess AI Assistant" },
      {
        property: "og:description",
        content: "Continue your conversation with the Hamduk Chess AI coach.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Chat failed to load: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Conversation not found.</div>
  ),
  component: AssistantThreadPage,
});

function AssistantThreadPage() {
  const { threadId } = Route.useParams();
  const fetchThread = useServerFn(getThread);

  const { data, isLoading, error } = useQuery({
    queryKey: ["assistant-thread", threadId],
    queryFn: () => fetchThread({ data: { threadId } }),
  });

  return (
    <div className="flex h-screen min-h-0">
      <div className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col">
        <ThreadList activeThreadId={threadId} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h1 className="truncate font-serif text-base font-bold text-foreground">
              {data?.thread?.title ?? "Coach chat"}
            </h1>
          </div>
          <Link
            to="/insights"
            className="rounded-md bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground hover:bg-secondary/80"
          >
            My weaknesses
          </Link>
        </header>

        {isLoading && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading conversation…
          </div>
        )}
        {error && (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && !data?.thread && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
            Conversation not found.
            <Link to="/assistant" className="text-primary underline">
              Start a new one
            </Link>
          </div>
        )}
        {data?.thread && (
          <div className="min-h-0 flex-1 pb-16 md:pb-0">
            <AssistantChat
              key={threadId}
              threadId={threadId}
              initialMessages={(data.messages ?? []) as unknown as UIMessage[]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
