import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json } from "@/lib/api-keys.server";

/** Flags correspondence games whose move deadline (plus 1h grace) has passed. */
export const Route = createFileRoute("/api/public/v1/correspondence/sweep")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withApiKey(request, "/v1/correspondence/sweep", "games:read", async () => {
          const { sweepCorrespondenceDeadlines } = await import("@/lib/correspondence.server");
          return json(await sweepCorrespondenceDeadlines());
        }),
    },
  },
});
