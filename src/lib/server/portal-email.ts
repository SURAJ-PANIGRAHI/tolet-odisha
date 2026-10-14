import "server-only";
import { serverDb } from "./lifecycle";
type Job = {
  id: string;
  claim_token: string;
  kind: "report" | "reminder";
  recipient: string;
  listing_id: string;
  payload: {
    title: string;
    reason?: string;
    description?: string;
    token?: string;
  };
};
export async function dispatchPortalEmails(limit = 5) {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !process.env.APP_URL
  )
    return { configured: false, sent: 0, failed: 0 };
  const origin = new URL(process.env.APP_URL).origin;
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost"))
    throw new Error("Invalid application URL");
  const db = serverDb();
  const jobs = await db.rpc("portal_claim_emails", { p_limit: limit });
  if (jobs.error) throw jobs.error;
  let sent = 0,
    failed = 0;
  for (const job of (jobs.data || []) as Job[]) {
    let success = false,
      permanent = false;
    try {
      const report = job.kind === "report";
      const text = report
        ? `A listing was reported.\n\nListing: ${job.payload.title}\nReason: ${job.payload.reason}\nNote: ${job.payload.description || "None"}\n\nReview: ${origin}/dashboard/admin\nListing ID: ${job.listing_id}`
        : `Your listing "${job.payload.title}" expires within three days. Would you like to list it for another 30 days? Renewal is free.\n\nRenew: ${origin}/renew?portal=1&token=${job.payload.token}\n\nIf you take no action, it will expire automatically.`;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `portal-${job.id}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [job.recipient],
          subject: report
            ? "ToLet Odisha — listing report"
            : "Your ToLet Odisha listing expires soon",
          text,
        }),
      });
      success = response.ok;
      permanent =
        !success &&
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429;
    } catch {
      /* Durable retry; no recipient, payload or private token in logs. */
    }
    const result = await db.rpc("portal_finish_email", {
      p_job: job.id,
      p_claim: job.claim_token,
      p_sent: success,
      p_permanent: permanent,
    });
    if (result.error) throw result.error;
    if (success) sent++;
    else failed++;
  }
  return { configured: true, sent, failed };
}
