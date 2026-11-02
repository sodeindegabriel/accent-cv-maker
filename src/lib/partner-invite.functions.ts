import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type SendPartnerInviteEmailsInput = {
  accessToken: string;
  memberIds: string[];
};

export type SendPartnerInviteEmailsResult = {
  sent: number;
  skipped_recent: number;
  failed: string[];
};

export const sendPartnerInviteEmails = createServerFn({ method: "POST" })
  .inputValidator((data: SendPartnerInviteEmailsInput) => data)
  .handler(async ({ data }): Promise<SendPartnerInviteEmailsResult> => {
    const supabaseUrl = process.env["VITE_SUPABASE_URL"];
    const supabaseAnonKey = process.env["VITE_SUPABASE_ANON_KEY"];
    const resendApiKey = process.env["RESEND_API_KEY"];

    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase env vars missing");
    if (!resendApiKey) throw new Error("RESEND_API_KEY missing");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });

    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      "reserve_partner_invite_emails",
      { p_member_ids: data.memberIds }
    );

    if (rpcErr) throw new Error(rpcErr.message);

    const result = rpcData as {
      partner_name: string;
      inviter_name: string;
      allowed: { member_id: string; email: string; role: string }[];
      skipped_recent: number;
    };

    const { partner_name, inviter_name, allowed, skipped_recent } = result;
    const failed: string[] = [];
    let sent = 0;

    for (const recipient of allowed) {
      const roleWord = recipient.role === "manager" ? "manager" : "mentor";
      const loginUrl = "https://www.cvlingo.com/partner/login";

      // Escape HTML special characters to prevent injection in the HTML body
      function esc(s: string) {
        return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }

      const safePartner = esc(partner_name);
      const safeInviter = esc(inviter_name);
      const safeEmail = esc(recipient.email);
      const safeRole = esc(roleWord);

      const textBody = [
        `Hi,`,
        ``,
        `${inviter_name} has added you to ${partner_name} on CVLingo as a ${roleWord}.`,
        ``,
        `CVLingo is a free CV builder in 21 languages.`,
        ``,
        `To sign in (no password needed):`,
        `1. Go to ${loginUrl}`,
        `2. Enter your email address (${recipient.email})`,
        `3. Enter the code we email you.`,
        ``,
        `Questions? Ask ${inviter_name}, who added you.`,
        ``,
        `If you were not expecting this, you can ignore this message.`,
        ``,
        `The CVLingo team`,
      ].join("\n");

      const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<p>Hi,</p>
<p><strong>${safeInviter}</strong> has added you to <strong>${safePartner}</strong> on CVLingo as a <strong>${safeRole}</strong>.</p>
<p>CVLingo is a free CV builder in 21 languages.</p>
<p><strong>No password is needed.</strong> To sign in:</p>
<ol>
  <li>Go to <a href="${loginUrl}" style="color:#0d6e6e">${loginUrl}</a></li>
  <li>Enter your email address (${safeEmail})</li>
  <li>Enter the code we email you.</li>
</ol>
<p style="margin-top:24px">
  <a href="${loginUrl}" style="display:inline-block;background:#0d6e6e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Sign in to CVLingo</a>
</p>
<p style="color:#555;font-size:14px">Questions? Ask ${safeInviter}, who added you.</p>
<p style="color:#888;font-size:13px">If you were not expecting this, you can ignore this message.</p>
</body>
</html>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CVLingo <noreply@cvlingo.com>",
            to: [recipient.email],
            subject: `You have been added to ${partner_name} on CVLingo`,
            text: textBody,
            html: htmlBody,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`[sendPartnerInviteEmails] Resend error for ${recipient.email}:`, errText);
          failed.push(recipient.email);
        } else {
          sent++;
        }
      } catch (err) {
        console.error(`[sendPartnerInviteEmails] fetch error for ${recipient.email}:`, err);
        failed.push(recipient.email);
      }
    }

    return { sent, skipped_recent, failed };
  });
