import { createFileRoute } from "@tanstack/react-router";
import { PuzzleHub } from "@/components/puzzles/PuzzleHub";

export const Route = createFileRoute("/puzzles")({
  head: () => ({
    meta: [
      { title: "Puzzles — Hamduk Chess" },
      { name: "description", content: "Daily chess puzzle, rated ladder, and themed tactical sets. Build a streak and climb." },
      { property: "og:title", content: "Puzzles — Hamduk Chess" },
      { property: "og:description", content: "Daily chess puzzle, rated ladder, and themed tactical sets." },
    ],
  }),
  component: PuzzlesPage,
});

function PuzzlesPage() {
  return <PuzzleHub />;
}
