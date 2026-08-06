import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createThread, listThreads } from "@/lib/assistant.functions";
import { ThreadList } from "@/components/assistant/ThreadList";

export const Route = createFileRoute("/assistant/")({
  head: () => ({
    meta: [
      { title: "AI Chess Assistant — Hamduk Chess" },
      {
        name: "description",
        content:
          "Chat with your personal AI chess coach: plain-language explanations of your mistakes, plans and next training steps.",
      },
      { property: "og:title", content: "AI Chess Assistant — Hamduk Chess" },
      {
        property: "og:description",
        content:
          "Chat with your personal AI chess coach about your games, mistakes and what to train next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantIndex,
});

function AssistantIndex() {
  const fetchThreads = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const navigate = useNavigate();
  const bootstrapped = useRef(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["assistant-threads"],
    queryFn: () => fetchThreads(),
  });

  useEffect(() => {
    if (isLoading || !data || bootstrapped.current) return;
    bootstrapped.current = true;
    const newest = data.threads[0];
    if (newest) {
      navigate({ to: "/assistant/$threadId", params: { threadId: newest.id }, replace: true });
      return;
    }
    create({ data: {} })
      .then((res) => {
        if (res.thread?.id) {
          navigate({
            to: "/assistant/$threadId",
            params: { threadId: res.thread.id },
            replace: true,
          });
        }
      })
      .catch((e: Error) => toast.error(e.message));
  }, [data, isLoading, create, navigate]);

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-0">
      <div className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col">
        <ThreadList />
      </div>
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {error ? (error as Error).message : "Opening your coach…"}
      </div>
    </div>
  );
}
