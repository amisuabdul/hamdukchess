import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json } from "@/lib/api-keys.server";

/** Retries webhook deliveries whose backoff window has elapsed (1s, 5s, 25s). */
export const Route = createFileRoute("/api/public/v1/webhooks/retry-sweep")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withApiKey(request, "/v1/webhooks/retry-sweep", "webhooks", async () => {
          const { retryDueDeliveries } = await import("@/lib/webhooks.server");
          const processed = await retryDueDeliveries();
          return json({ processed });
        }),
    },
  },
});
