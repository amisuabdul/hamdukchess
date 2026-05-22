import { createFileRoute } from "@tanstack/react-router";
import { ChessApp } from "@/components/chess/ChessApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grandmaster — Chess" },
      { name: "description", content: "Play chess against a friend or Stockfish in a focused, tournament-grade interface." },
      { property: "og:title", content: "Grandmaster — Chess" },
      { property: "og:description", content: "Play chess against a friend or Stockfish in a focused, tournament-grade interface." },
    ],
  }),
  component: Index,
});

function Index() {
  return <ChessApp />;
}
