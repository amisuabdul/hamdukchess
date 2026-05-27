import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Send, MessageSquare } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getConversations,
  getConversation,
  sendMessage,
} from "@/lib/social.functions";

const searchSchema = z.object({ with: z.string().optional() });

export const Route = createFileRoute("/messages")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Messages — Hamduk Chess" },
      { name: "description", content: "Direct messages with other Hamduk Chess players." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { with: withUser } = Route.useSearch();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
          Sign in to view messages.
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-[320px_1fr]">
        <ConversationList activeUsername={withUser} />
        <div className="rounded-2xl border border-border bg-card">
          {withUser ? (
            <Conversation username={withUser} />
          ) : (
            <div className="flex h-[60vh] flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="mb-2 h-10 w-10 opacity-40" />
              <p>Select a conversation to start chatting.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ConversationList({ activeUsername }: { activeUsername?: string }) {
  const fetchList = useServerFn(getConversations);
  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetchList(),
    refetchInterval: 15000,
  });
  const convos = data?.conversations ?? [];

  return (
    <aside className="rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-serif text-lg font-bold">Messages</h2>
      </header>
      <ul className="max-h-[70vh] overflow-y-auto">
        {convos.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No conversations yet. Open a profile and tap Message.
          </li>
        )}
        {convos.map((c) => (
          <li key={c.userId}>
            <Link
              to="/messages"
              search={{ with: c.username }}
              className={`flex items-start justify-between gap-2 border-b border-border px-4 py-3 hover:bg-accent/30 ${
                activeUsername === c.username ? "bg-accent/40" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.username}</p>
                <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {c.unread}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Conversation({ username }: { username: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fetchConvo = useServerFn(getConversation);
  const sendFn = useServerFn(sendMessage);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data, refetch } = useQuery({
    queryKey: ["conversation", username],
    queryFn: () => fetchConvo({ data: { username } }),
  });

  useEffect(() => {
    if (!user || !data?.other) return;
    const otherId = data.other.id;
    const channel = supabase
      .channel(`dm:${user.id}:${otherId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as { sender_id: string; recipient_id: string };
          if (
            (m.sender_id === otherId && m.recipient_id === user.id) ||
            (m.sender_id === user.id && m.recipient_id === otherId)
          ) {
            refetch();
            qc.invalidateQueries({ queryKey: ["conversations"] });
          }
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user, data?.other, refetch, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  const send = useMutation({
    mutationFn: () =>
      sendFn({ data: { recipientId: data!.other!.id, content: text.trim() } }),
    onSuccess: () => {
      setText("");
      refetch();
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  if (!data) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!data.other)
    return <div className="p-6 text-muted-foreground">Player not found.</div>;

  return (
    <div className="flex h-[70vh] flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link
          to="/profile/$username"
          params={{ username: data.other.username }}
          className="font-serif text-lg font-bold hover:underline"
        >
          {data.other.username}
        </Link>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {data.messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet. Say hello.
          </p>
        )}
        {data.messages.map((m) => {
          const mine = m.sender_id === user!.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
                <div className="mt-1 text-[10px] opacity-60">
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder={`Message ${data.other.username}…`}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}
