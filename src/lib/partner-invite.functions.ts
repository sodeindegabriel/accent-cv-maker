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
      const emailBody = [
        `Hi,`,
        ``,
        `${inviter_name} has added you to ${partner_name} on CVLingo as a ${roleWord}.`,
        ``,
        `To sign in:`,
        `1. Go to https://cvlingo.com/partner/login`,
        `2. Enter your email address (${recipient.email})`,
        `3. Enter the code we email you.`,
        ``,
        `The CVLingo team`,
      ].join("\n");

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
            text: emailBody,
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
