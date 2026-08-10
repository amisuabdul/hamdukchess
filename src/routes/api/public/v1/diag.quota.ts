// TEMPORARY diagnostic route: inspects the Redis quota counters for one API key
// and deletes any counter holding a non-numeric value. Delete after use.
import { createFileRoute } from "@tanstack/react-router";
import { redis } from "@/lib/redis.server";
import { json } from "@/lib/api-keys.server";

const KEY_ID = "328f3a79-dd14-4963-b20a-2f443c99283b";

export const Route = createFileRoute("/api/public/v1/diag/quota")({
  server: {
    handlers: {
      GET: async () => {
        const patterns = [`apib:${KEY_ID}:*`, `apiq:${KEY_ID}:*`];
        const report: Array<{ key: string; value: unknown; deleted: boolean }> = [];
        for (const pattern of patterns) {
          const keys = (await redis.keys(pattern)) as string[];
          for (const key of keys) {
            let value: unknown;
            let deleted = false;
            try {
              value = await redis.get(key);
            } catch (err) {
              value = `<unreadable: ${String(err)}>`;
            }
            const numeric = typeof value === "number" || /^-?\d+$/.test(String(value ?? ""));
            if (!numeric) {
              await redis.del(key);
              deleted = true;
            }
            report.push({ key, value, deleted });
          }
        }
        return json({ keyId: KEY_ID, report });
      },
    },
  },
});
