import { createFileRoute } from "@tanstack/react-router";
import { AnalysisApp } from "@/components/chess/AnalysisApp";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analysis Studio — Chess" },
      {
        name: "description",
        content:
          "Replay games, import PGN or FEN, and ask an AI coach to explain any position.",
      },
      { property: "og:title", content: "Analysis Studio — Chess" },
      {
        property: "og:description",
        content:
          "Replay games, import PGN or FEN, and ask an AI coach to explain any position.",
      },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  return <AnalysisApp />;
}
