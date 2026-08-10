import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertRate } from "./rate-limit.server";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const Id = z.object({ studyId: z.string().uuid() });

async function loadBoard(studyId: string) {
  const { data, error } = await supabaseAdmin
    .from("study_boards")
    .select("id, owner_id, collaborators, visibility")
    .eq("id", studyId)
    .maybeSingle();
  if (error || !data) throw new Error("Study not found");
  return data;
}

function assertEditor(
  board: { owner_id: string; collaborators: string[] | null },
  userId: string,
) {
  const collaborators = board.collaborators ?? [];
  if (board.owner_id !== userId && !collaborators.includes(userId)) {
    throw new Error("You do not have edit access to this study");
  }
}

function assertOwner(board: { owner_id: string }, userId: string) {
  if (board.owner_id !== userId) throw new Error("Only the study owner can do that");
}

export const createStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(1).max(80).default("Untitled study"),
        startFen: z.string().trim().max(120).optional(),
        startPgn: z.string().trim().max(20_000).optional(),
        visibility: z.enum(["private", "shared", "public"]).default("private"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertRate(userId, "study-create", 20, 3600);

    // Validate the starting position / PGN with chess.js before persisting.
    let startFen = data.startFen?.trim() || START_FEN;
    let currentFen = startFen;
    let currentPgn = "";
    try {
      if (data.startPgn) {
        const chess = new Chess(data.startFen ? startFen : undefined);
        chess.loadPgn(data.startPgn, { strict: false });
        currentFen = chess.fen();
        currentPgn = chess.pgn();
      } else {
        const chess = new Chess(startFen);
        startFen = chess.fen();
        currentFen = startFen;
      }
    } catch {
      throw new Error("That starting position or PGN is not valid");
    }

    const { data: row, error } = await supabaseAdmin
      .from("study_boards")
      .insert({
        owner_id: userId,
        title: data.title,
        start_fen: startFen,
        start_pgn: data.startPgn ?? null,
        current_fen: currentFen,
        current_pgn: currentPgn,
        visibility: data.visibility,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not create study");
    return { studyId: row.id };
  });

export const updateStudyState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({
      pgn: z.string().max(60_000),
      annotations: z.record(z.string(), z.string().max(2000)).optional(),
      shapes: z.record(z.string(), z.array(z.string().max(24)).max(64)).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const board = await loadBoard(data.studyId);
    assertEditor(board, userId);

    const { data: full } = await supabaseAdmin
      .from("study_boards")
      .select("start_fen")
      .eq("id", data.studyId)
      .single();

    const chess = new Chess(full?.start_fen ?? START_FEN);
    if (data.pgn.trim()) {
      try {
        chess.loadPgn(data.pgn, { strict: false });
      } catch {
        throw new Error("Invalid move list");
      }
    }

    const patch: Record<string, unknown> = {
      current_pgn: chess.pgn(),
      current_fen: chess.fen(),
    };
    if (data.annotations) patch.annotations = data.annotations;
    if (data.shapes) patch.shapes = data.shapes;

    const { error } = await supabaseAdmin
      .from("study_boards")
      .update(patch)
      .eq("id", data.studyId);
    if (error) throw new Error(error.message);
    return { ok: true, fen: chess.fen(), pgn: chess.pgn() };
  });

export const setStudyVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ visibility: z.enum(["private", "shared", "public"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const board = await loadBoard(data.studyId);
    assertOwner(board, context.userId);
    const { error } = await supabaseAdmin
      .from("study_boards")
      .update({ visibility: data.visibility })
      .eq("id", data.studyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ title: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const board = await loadBoard(data.studyId);
    assertOwner(board, context.userId);
    await supabaseAdmin.from("study_boards").update({ title: data.title }).eq("id", data.studyId);
    return { ok: true };
  });

export const inviteCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({ username: z.string().trim().min(3).max(32) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const board = await loadBoard(data.studyId);
    assertOwner(board, context.userId);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("username", data.username)
      .maybeSingle();
    if (!profile) throw new Error("No player with that username");
    if (profile.id === board.owner_id) throw new Error("You already own this study");

    const collaborators = board.collaborators ?? [];
    if (collaborators.includes(profile.id)) throw new Error("Already a collaborator");

    const { error } = await supabaseAdmin
      .from("study_boards")
      .update({ collaborators: [...collaborators, profile.id] })
      .eq("id", data.studyId);
    if (error) throw new Error(error.message);
    return { ok: true, username: profile.username };
  });

export const removeCollaborator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const board = await loadBoard(data.studyId);
    assertOwner(board, context.userId);
    const next = (board.collaborators ?? []).filter((c) => c !== data.userId);
    await supabaseAdmin.from("study_boards").update({ collaborators: next }).eq("id", data.studyId);
    return { ok: true };
  });

export const deleteStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const board = await loadBoard(data.studyId);
    assertOwner(board, context.userId);
    await supabaseAdmin.from("study_boards").delete().eq("id", data.studyId);
    return { ok: true };
  });

export const saveSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({
      name: z.string().trim().min(1).max(60),
      fen: z.string().trim().max(120),
      pgn: z.string().max(60_000),
      comment: z.string().trim().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const board = await loadBoard(data.studyId);
    assertEditor(board, userId);
    await assertRate(userId, "study-snapshot", 60, 3600);

    const { error } = await supabaseAdmin.from("study_snapshots").insert({
      board_id: data.studyId,
      created_by: userId,
      name: data.name,
      data: { fen: data.fen, pgn: data.pgn, comment: data.comment ?? null },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ snapshotId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: snap } = await supabaseAdmin
      .from("study_snapshots")
      .select("id, board_id")
      .eq("id", data.snapshotId)
      .maybeSingle();
    if (!snap) throw new Error("Snapshot not found");
    const board = await loadBoard(snap.board_id);
    assertEditor(board, context.userId);
    await supabaseAdmin.from("study_snapshots").delete().eq("id", data.snapshotId);
    return { ok: true };
  });

export const postStudyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ content: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const board = await loadBoard(data.studyId);
    assertEditor(board, userId);
    await assertRate(userId, "study-chat", 60, 60);
    const { error } = await supabaseAdmin
      .from("study_chat")
      .insert({ board_id: data.studyId, user_id: userId, content: data.content });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Board + collaborator usernames, resolved server-side so anon viewers work too. */
export const getStudyMeta = createServerFn({ method: "GET" })
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data }) => {
    const { data: board } = await supabaseAdmin
      .from("study_boards")
      .select("id, owner_id, collaborators, visibility, title")
      .eq("id", data.studyId)
      .maybeSingle();
    if (!board) throw new Error("Study not found");

    const ids = [board.owner_id, ...(board.collaborators ?? [])];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .in("id", ids);

    return {
      title: board.title,
      visibility: board.visibility,
      ownerId: board.owner_id,
      people: (profiles ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        isOwner: p.id === board.owner_id,
      })),
    };
  });
