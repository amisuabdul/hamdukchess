import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UserIdSchema = z.object({ userId: z.string().uuid() });

// ---------- FOLLOWS ----------
export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Cannot follow yourself");
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: userId, following_id: data.userId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("following_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- FRIENDS ----------
export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Cannot friend yourself");
    // If reverse pending exists, accept it instead
    const { data: reverse } = await supabase
      .from("friends")
      .select("id, status")
      .eq("requester_id", data.userId)
      .eq("addressee_id", userId)
      .maybeSingle();
    if (reverse) {
      if (reverse.status === "pending") {
        await supabase.from("friends").update({ status: "accepted" }).eq("id", reverse.id);
      }
      return { ok: true };
    }
    const { error } = await supabase
      .from("friends")
      .insert({ requester_id: userId, addressee_id: data.userId, status: "pending" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ requestId: z.string().uuid(), accept: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.accept) {
      const { error } = await supabase
        .from("friends")
        .update({ status: "accepted" })
        .eq("id", data.requestId)
        .eq("addressee_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("friends")
        .delete()
        .eq("id", data.requestId)
        .eq("addressee_id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("friends")
      .delete()
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- RELATION STATE (for profile page) ----------
export const getRelation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UserIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: follow }, { data: friend }] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", userId)
        .eq("following_id", data.userId)
        .maybeSingle(),
      supabase
        .from("friends")
        .select("id, status, requester_id, addressee_id")
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
        )
        .maybeSingle(),
    ]);
    return {
      isFollowing: !!follow,
      friend: friend
        ? {
            id: friend.id,
            status: friend.status as "pending" | "accepted" | "blocked",
            iAmRequester: friend.requester_id === userId,
          }
        : null,
    };
  });

// ---------- LISTS (friends + incoming requests) ----------
export const getMyFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("friends")
      .select("id, status, requester_id, addressee_id, created_at")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const otherIds = (rows ?? []).map((r) =>
      r.requester_id === userId ? r.addressee_id : r.requester_id,
    );
    let profiles: Record<string, { username: string; rating: number }> = {};
    if (otherIds.length) {
      const { data: ps } = await supabaseAdmin
        .from("profiles")
        .select("id, username, rating")
        .in("id", otherIds);
      for (const p of ps ?? []) profiles[p.id] = { username: p.username, rating: p.rating };
    }
    return {
      accepted: (rows ?? [])
        .filter((r) => r.status === "accepted")
        .map((r) => {
          const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
          return { id: r.id, userId: otherId, ...profiles[otherId] };
        }),
      incoming: (rows ?? [])
        .filter((r) => r.status === "pending" && r.addressee_id === userId)
        .map((r) => ({ id: r.id, userId: r.requester_id, ...profiles[r.requester_id] })),
      outgoing: (rows ?? [])
        .filter((r) => r.status === "pending" && r.requester_id === userId)
        .map((r) => ({ id: r.id, userId: r.addressee_id, ...profiles[r.addressee_id] })),
    };
  });

// ---------- MESSAGES ----------
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        recipientId: z.string().uuid(),
        content: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.recipientId === userId) throw new Error("Cannot message yourself");
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        recipient_id: data.recipientId,
        content: data.content,
      })
      .select("id, content, created_at, sender_id, recipient_id, read")
      .single();
    if (error) throw new Error(error.message);
    return { message: msg };
  });

export const getConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Pull last 200 messages involving me, then dedupe by counterpart.
    const { data: msgs, error } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, recipient_id, content, read, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const byOther = new Map<
      string,
      { lastMessage: string; lastAt: string; unread: number }
    >();
    for (const m of msgs ?? []) {
      const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
      const existing = byOther.get(otherId);
      const isUnreadForMe = m.recipient_id === userId && !m.read;
      if (!existing) {
        byOther.set(otherId, {
          lastMessage: m.content,
          lastAt: m.created_at,
          unread: isUnreadForMe ? 1 : 0,
        });
      } else if (isUnreadForMe) {
        existing.unread += 1;
      }
    }

    const otherIds = Array.from(byOther.keys());
    let profiles: Record<string, { username: string }> = {};
    if (otherIds.length) {
      const { data: ps } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", otherIds);
      for (const p of ps ?? []) profiles[p.id] = { username: p.username };
    }

    return {
      conversations: otherIds.map((id) => ({
        userId: id,
        username: profiles[id]?.username ?? "unknown",
        ...byOther.get(id)!,
      })),
    };
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ username: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: other } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("username", data.username)
      .maybeSingle();
    if (!other) return { other: null, messages: [] };

    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, read, created_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    // Mark unread incoming as read
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("sender_id", other.id)
      .eq("recipient_id", userId)
      .eq("read", false);

    return { other, messages: msgs ?? [] };
  });

// ---------- ACTIVITY FEED ----------
export const getMyFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Get list of users I follow
    const { data: follows } = await supabaseAdmin
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const ids = (follows ?? []).map((f) => f.following_id);
    if (ids.length === 0) return { items: [] };

    const { data: items, error } = await supabaseAdmin
      .from("activity_feed")
      .select("id, user_id, type, payload, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((items ?? []).map((i) => i.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

    return {
      items: (items ?? []).map((i) => ({
        id: i.id,
        type: i.type,
        payload: i.payload,
        createdAt: i.created_at,
        username: nameById.get(i.user_id) ?? "unknown",
      })),
    };
  });
