import { cleanupAccountIds } from "@/lib/server/account-id";
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
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "Invalid origin." }, 403);
  try {
    const auth = await portalUser(request);
    if (!auth)
      return reply({ error: "Please sign in with email or Google." }, 401);
    if (!(await consumeQuota("account-id-uploads-global", 50)))
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
    const name = String(form.get("name") || "").trim();
    if (name.length < 2 || name.length > 120) return reply({error:"Enter your full name exactly as it appears on the ID."},400);
    if (type === "masked_aadhaar" && form.get("masked") !== "yes") return reply({error:"Confirm that the first eight Aadhaar digits are hidden."},400);
    const ticket = await auth.db.rpc("account_prepare_id_upload", {p_actor:auth.user.id,p_type:type,p_name:name,p_extension:format.ext});
    if(ticket.error) {
      if(ticket.error.code === 'P0001' || ticket.error.code === '23505') return reply({error:"An ID is already on file, or your daily upload limit was reached. Refresh your verification status."},409);
      throw ticket.error;
    }
    const reserved = ticket.data?.[0];
    if(!reserved) throw new Error("No upload reservation");
    const path = reserved.object_path;
    const bucket = auth.db.storage.from("account-government-ids");
    const upload = await bucket.upload(path, bytes, {
      contentType: file.type,
      upsert: false,
      cacheControl: "0",
    });
    if (upload.error) throw upload.error;
    const registered = await auth.db.rpc("account_finish_id_upload", {p_actor:auth.user.id,p_document:reserved.document_id});
    // An uncertain response must not delete a potentially registered document.
    // The reserved upload is reconciled by durable cleanup if completion failed.
    if(registered.error || registered.data !== true) throw new Error("Unable to register ID");
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

export async function GET(request: Request) {
 try {
  const auth=await portalUser(request);if(!auth)return reply({error:"Please sign in."},401);
  const result=await auth.db.rpc('account_my_id_status',{p_actor:auth.user.id});
  if(result.error)throw result.error;
  return reply({document:result.data?.[0] || null});
 }catch{return reply({error:"Unable to load verification status."},503);}
}
export async function DELETE(request: Request) {
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:"Invalid origin."},403);
 try {
  const auth=await portalUser(request);if(!auth)return reply({error:"Please sign in."},401);
  const result=await auth.db.rpc('account_withdraw_id',{p_actor:auth.user.id});if(result.error)throw result.error;
  const cleanup=await cleanupAccountIds(auth.db,5);
  return reply({withdrawn:true,cleanup_pending:cleanup.failed>0});
 }catch{return reply({error:"Unable to withdraw the ID. Please retry."},503);}
}
