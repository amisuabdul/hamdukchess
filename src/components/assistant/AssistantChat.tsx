import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  threadId: string;
  initialMessages: UIMessage[];
};

function textOf(message: UIMessage) {
  return message.parts
    .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join("");
}

const STARTERS = [
  "Why do I keep losing winning positions?",
  "Explain my last blunder in plain English.",
  "What should I practise this week?",
];

export function AssistantChat({ threadId, initialMessages }: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, id }) => {
          const { data } = await supabase.auth.getSession();
          return {
            body: { messages, threadId: id },
            headers: {
              Authorization: `Bearer ${data.session?.access_token ?? ""}`,
            },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat<UIMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => toast.error(error.message || "The coach could not answer right now."),
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  useEffect(() => {
    if (!isBusy) inputRef.current?.focus();
  }, [isBusy]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  const submit = async (text: string) => {
    const value = text.trim();
    if (!value || isBusy) return;
    setInput("");
    await sendMessage({ text: value });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-3 font-serif text-xl font-bold text-foreground">
              Your personal chess companion
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask about a game, a mistake, or what to train next. I know your recent results and
              weakness report.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-md border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm text-foreground"
              }
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap">{textOf(message)}</p>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:font-serif">
                  <ReactMarkdown>{textOf(message)}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
        className="border-t border-border bg-background/95 p-3 backdrop-blur"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
              }
            }}
            rows={1}
            placeholder="Ask your coach anything…"
            className="max-h-40 min-h-[42px] flex-1 resize-y rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={isBusy || input.trim().length === 0}
            className="inline-flex h-[42px] items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
