import { randomUUID } from "node:crypto";
import { portalUser } from "@/lib/server/portal-auth";
import { consumeQuota } from "@/lib/server/lifecycle";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_PORTAL_V2_ENABLED !== "true")
    return reply({ error: "ID verification is not enabled yet." }, 503);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "Invalid origin." }, 403);
  try {
    const auth = await portalUser(request, true);
    if (!auth)
      return reply({ error: "Start a guest session or sign in first." }, 401);
    if (!(await consumeQuota("portal-id-uploads-global", 50)))
      return reply({ error: "Please try again later." }, 429);
    if (
      !request.body ||
      Number(request.headers.get("content-length") || 0) > 3500000
    )
      return reply({ error: "Upload an image under 3 MB." }, 413);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > 3500000) {
          await reader.cancel();
          return reply({ error: "Upload an image under 3 MB." }, 413);
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("document");
    const type = form.get("type");
    if (
      !(file instanceof File) ||
      file.size <= 0 ||
      file.size > 3 * 1024 * 1024 ||
      !["passport", "masked_aadhaar", "driving_licence", "voter_id"].includes(
        String(type),
      ) ||
      form.get("consent") !== "yes"
    )
      return reply(
        { error: "Choose an accepted ID image and provide consent." },
        400,
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    const formats: Record<string, { ext: string; valid: boolean }> = {
      "image/jpeg": {
        ext: "jpg",
        valid: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      },
      "image/png": {
        ext: "png",
        valid: bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      },
      "image/webp": {
        ext: "webp",
        valid:
          bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP",
      },
    };
    const format = formats[file.type];
    if (!format?.valid)
      return reply({ error: "Use a JPEG, PNG or WebP image." }, 400);
    const status = await auth.db.rpc("portal_my_id_status", {
      p_actor: auth.user.id,
    });
    if (status.error) throw status.error;
    if (status.data?.[0] && !["deleted"].includes(status.data[0].status))
      return reply(
        {
          error:
            "An ID is already on file. Wait for its review or scheduled deletion before replacing it.",
        },
        409,
      );
    const profile = await auth.db
      .from("portal_profiles")
      .select("display_name")
      .eq("user_id", auth.user.id)
      .single();
    if (
      profile.error ||
      !profile.data.display_name ||
      profile.data.display_name.trim().length < 2
    )
      return reply(
        { error: "Save your full account name before uploading ID." },
        400,
      );
    const path = `${auth.user.id}/${randomUUID()}.${format.ext}`;
    const ticket = await auth.db.rpc("portal_prepare_id_upload", {
      p_actor: auth.user.id,
      p_path: path,
    });
    if (ticket.error) throw ticket.error;
    const bucket = auth.db.storage.from("portal-government-ids");
    const upload = await bucket.upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) throw upload.error;
    const registered = await auth.db.rpc("portal_register_id_upload", {
      p_actor: auth.user.id,
      p_type: type,
      p_path: path,
      p_consent_version: "portal-id-v1",
    });
    if (registered.error) {
      // Only remove an orphan on a definitive SQL rejection; uncertain transport failures must be reconciled.
      if (registered.error.code && !registered.error.code.startsWith("PGRST"))
        await bucket.remove([path]);
      throw registered.error;
    }
    return reply({
      pending: true,
      message: "Verification Pending (Up to 48 Hours)",
    });
  } catch {
    return reply(
      { error: "Unable to upload ID. Please retry or contact support." },
      503,
    );
  }
}
