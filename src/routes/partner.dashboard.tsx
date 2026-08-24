import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { jsPDF } from "jspdf";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ObfuscatedEmail } from "@/components/ObfuscatedEmail";
import { sanitizeCvHtml } from "@/lib/sanitize";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

// ── Types ──────────────────────────────────────────────────────────────────────
interface PartnerDashboardData {
  partner_id: string;
  partner_name: string;
  referral_code: string;
  member_role: "owner" | "editor";
  member_count: number;
  total_cvs: number;
  month_cvs: number;
  active_this_month: number;
  total_candidates: number;
  lang_breakdown: Record<string, number>;
  job_breakdown: Record<string, number>;
  recent_candidates: Array<{
    display_name: string;
    language: string;
    opted_in_at: string;
    job_types: string[];
  }>;
}

interface PartnerClient {
  candidate_id: string;
  display_name: string;
  language: string;
  job_types: string[];
  opted_in_at: string;
  has_cv: boolean;
  cv_english_html: string | null;
}

// ── Email helper ───────────────────────────────────────────────────────────────
async function sendTeamInviteEmail(partnerName: string, inviteeEmail: string) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[team invite] EmailJS env vars missing — skipping email");
    return;
  }
  const subject = `You've been invited to view ${partnerName}'s CVLingo dashboard`;
  const message = [
    `Hi,`,
    "",
    `You've been added as a team member on ${partnerName}'s CVLingo partner dashboard.`,
    "",
    "To access the dashboard:",
    "Go to cvlingo.com, click Log in, and enter this email address to receive a one-time login code. You can set a password later from your dashboard if you'd prefer not to use a code each time.",
    "",
    "The CVLingo team",
  ].join("\n");
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    { to_email: inviteeEmail, subject, message, name: partnerName },
    { publicKey: PUBLIC_KEY },
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function currentMonthLabel() {
  return new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function impactSummary(data: PartnerDashboardData): string {
  const topLangs = Object.entries(data.lang_breakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lang]) => lang);
  const langStr =
    topLangs.length > 0
      ? ` in ${topLangs.length === 1 ? topLangs[0] : topLangs.slice(0, -1).join(", ") + " and " + topLangs[topLangs.length - 1]}`
      : "";
  return `In ${currentMonthLabel()}, ${data.month_cvs === 0 ? "no" : data.month_cvs} CV${data.month_cvs !== 1 ? "s" : ""} ${data.month_cvs === 1 ? "was" : "were"} built through ${data.partner_name}'s link${langStr}. ${data.total_candidates > 0 ? `${data.total_candidates} candidate${data.total_candidates !== 1 ? "s are" : " is"} in the talent pool.` : ""}`;
}

// ── PDF generation ─────────────────────────────────────────────────────────────
function downloadCvPdf(htmlContent: string, displayName: string) {
  const safeName = displayName.replace(/[^\w\s-]/g, "").trim();
  const filename = `${safeName} - CVLingo.pdf`;
  const el = document.createElement("div");
  el.innerHTML = sanitizeCvHtml(htmlContent);
  el.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:-9999px;";
  document.body.appendChild(el);
  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 18; const MR = 18; const CW = W - ML - MR;
    let y = 22;
    const newPageIfNeeded = (h: number) => { if (y + h > 282) { pdf.addPage(); y = 18; } };
    const cvName = el.querySelector(".cv-name")?.textContent?.trim() ?? displayName;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(26); pdf.setTextColor(26, 26, 26);
    pdf.splitTextToSize(cvName, CW).forEach((line: string) => { pdf.text(line, W / 2, y, { align: "center" }); y += 10; });
    y += 3;
    const cvContact = el.querySelector(".cv-contact")?.textContent?.trim() ?? "";
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(107, 114, 128);
    pdf.splitTextToSize(cvContact, CW).forEach((line: string) => { pdf.text(line, W / 2, y, { align: "center" }); y += 6; });
    y += 8;
    el.querySelectorAll(".cv-section").forEach((section) => {
      newPageIfNeeded(14);
      pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 5;
      const heading = section.querySelector("h2")?.textContent?.trim() ?? "";
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
      pdf.text(heading, ML, y); y += 6;
      section.querySelectorAll("p").forEach((p) => {
        if (p.closest(".cv-job") || p.closest(".cv-edu")) return;
        const txt = p.textContent?.trim() ?? ""; if (!txt) return;
        newPageIfNeeded(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
        pdf.splitTextToSize(txt, CW).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML, y); y += 6; }); y += 3;
      });
      section.querySelectorAll(".cv-job").forEach((job) => {
        newPageIfNeeded(8);
        const jobP = job.querySelector("p");
        if (jobP) {
          const titleText = jobP.querySelector("strong")?.textContent?.trim() ?? "";
          const dateText = jobP.querySelector(".cv-date")?.textContent?.trim() ?? "";
          let companyText = "";
          jobP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) companyText += node.textContent ?? ""; });
          companyText = companyText.trim();
          pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
          const titleW = pdf.getTextWidth(titleText + " ");
          pdf.text(titleText, ML, y); pdf.setFont("helvetica", "normal");
          if (companyText) pdf.text(companyText, ML + titleW, y);
          if (dateText) { pdf.setTextColor(107, 114, 128); pdf.text(dateText, W - MR, y, { align: "right" }); pdf.setTextColor(26, 26, 26); }
          y += 6;
        }
        job.querySelectorAll("li").forEach((li) => {
          const txt = li.textContent?.trim() ?? ""; if (!txt) return;
          newPageIfNeeded(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
          pdf.text("•", ML + 1, y);
          pdf.splitTextToSize(txt, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; });
        });
        y += 2;
      });
      section.querySelectorAll(".cv-edu").forEach((edu) => {
        newPageIfNeeded(8);
        const eduP = edu.querySelector("p");
        if (eduP) {
          const qualText = eduP.querySelector("strong")?.textContent?.trim() ?? "";
          const dateText = eduP.querySelector(".cv-date")?.textContent?.trim() ?? "";
          pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
          pdf.text(qualText, ML, y);
          if (dateText) { pdf.setTextColor(107, 114, 128); pdf.text(dateText, W - MR, y, { align: "right" }); }
          y += 6;
          let instText = "";
          eduP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) instText += node.textContent ?? ""; });
          instText = instText.trim();
          if (instText) { pdf.setFont("helvetica", "normal"); pdf.setTextColor(107, 114, 128); pdf.text(instText, ML, y); y += 6; }
        }
        y += 1;
      });
      section.querySelectorAll("ul > li").forEach((li) => {
        if (li.closest(".cv-job") || li.closest(".cv-edu")) return;
        const strongEl = li.querySelector("strong");
        newPageIfNeeded(6); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
        if (strongEl) {
          const label = strongEl.textContent?.trim() ?? "";
          let desc = "";
          li.childNodes.forEach((node) => { if (node !== strongEl && node.nodeType === Node.TEXT_NODE) desc += node.textContent ?? ""; });
          desc = desc.trim();
          pdf.setFont("helvetica", "bold"); pdf.text("• " + label, ML + 1, y); y += 6;
          if (desc) { pdf.setFont("helvetica", "normal"); pdf.splitTextToSize(desc, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; }); }
          y += 2;
        } else {
          const txt = li.textContent?.trim() ?? ""; if (!txt) return;
          pdf.setFont("helvetica", "normal"); pdf.text("•", ML + 1, y);
          pdf.splitTextToSize(txt, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; });
          y += 1;
        }
      });
      y += 4;
    });
    pdf.save(filename);
  } finally {
    document.body.removeChild(el);
  }
}

// ── Word (docx) generation ─────────────────────────────────────────────────────
async function downloadCvDocx(htmlContent: string, displayName: string) {
  const { Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType } =
    await import("docx");

  const el = document.createElement("div");
  el.innerHTML = sanitizeCvHtml(htmlContent);

  type DocParagraph = InstanceType<typeof Paragraph>;
  const children: DocParagraph[] = [];

  const cvName = el.querySelector(".cv-name")?.textContent?.trim() ?? displayName;
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: cvName, bold: true, size: 52, font: "Calibri" })],
      spacing: { after: 120 },
    }),
  );

  const cvContact = el.querySelector(".cv-contact")?.textContent?.trim() ?? "";
  if (cvContact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cvContact, size: 20, color: "6B7280", font: "Calibri" })],
        spacing: { after: 280 },
      }),
    );
  }

  el.querySelectorAll(".cv-section").forEach((section) => {
    const heading = section.querySelector("h2")?.textContent?.trim() ?? "";

    children.push(
      new Paragraph({
        border: { bottom: { color: "DCDCDC", style: BorderStyle.SINGLE, size: 6 } },
        children: [],
        spacing: { before: 240, after: 120 },
      }),
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: heading, bold: true, size: 26, color: "0D6E6E", font: "Calibri" })],
        spacing: { after: 120 },
      }),
    );

    section.querySelectorAll("p").forEach((p) => {
      if (p.closest(".cv-job") || p.closest(".cv-edu")) return;
      const txt = p.textContent?.trim() ?? "";
      if (!txt) return;
      children.push(
        new Paragraph({
          children: [new TextRun({ text: txt, size: 22, font: "Calibri" })],
          spacing: { after: 80 },
        }),
      );
    });

    section.querySelectorAll(".cv-job").forEach((job) => {
      const jobP = job.querySelector("p");
      if (jobP) {
        const titleText = jobP.querySelector("strong")?.textContent?.trim() ?? "";
        const dateText = jobP.querySelector(".cv-date")?.textContent?.trim() ?? "";
        let companyText = "";
        jobP.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) companyText += node.textContent ?? "";
        });
        companyText = companyText.trim();
        const runs = [
          ...(titleText ? [new TextRun({ text: titleText, bold: true, size: 22, font: "Calibri" })] : []),
          ...(companyText ? [new TextRun({ text: " " + companyText, size: 22, font: "Calibri" })] : []),
          ...(dateText ? [new TextRun({ text: "  " + dateText, size: 20, color: "6B7280", font: "Calibri" })] : []),
        ];
        children.push(new Paragraph({ children: runs, spacing: { after: 60 } }));
      }
      job.querySelectorAll("li").forEach((li) => {
        const txt = li.textContent?.trim() ?? "";
        if (!txt) return;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: txt, size: 22, font: "Calibri" })],
            bullet: { level: 0 },
            spacing: { after: 40 },
          }),
        );
      });
    });

    section.querySelectorAll(".cv-edu").forEach((edu) => {
      const eduP = edu.querySelector("p");
      if (eduP) {
        const qualText = eduP.querySelector("strong")?.textContent?.trim() ?? "";
        const dateText = eduP.querySelector(".cv-date")?.textContent?.trim() ?? "";
        let instText = "";
        eduP.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) instText += node.textContent ?? "";
        });
        instText = instText.trim();
        const runs = [
          ...(qualText ? [new TextRun({ text: qualText, bold: true, size: 22, font: "Calibri" })] : []),
          ...(instText ? [new TextRun({ text: " " + instText, size: 22, color: "6B7280", font: "Calibri" })] : []),
          ...(dateText ? [new TextRun({ text: "  " + dateText, size: 20, color: "6B7280", font: "Calibri" })] : []),
        ];
        children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
      }
    });

    section.querySelectorAll("ul > li").forEach((li) => {
      if (li.closest(".cv-job") || li.closest(".cv-edu")) return;
      const strongEl = li.querySelector("strong");
      const txt = li.textContent?.trim() ?? "";
      if (!txt) return;
      if (strongEl) {
        const label = strongEl.textContent?.trim() ?? "";
        let desc = "";
        li.childNodes.forEach((node) => {
          if (node !== strongEl && node.nodeType === Node.TEXT_NODE) desc += node.textContent ?? "";
        });
        desc = desc.trim();
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, size: 22, font: "Calibri" }),
              ...(desc ? [new TextRun({ text: " " + desc, size: 22, font: "Calibri" })] : []),
            ],
            bullet: { level: 0 },
            spacing: { after: 40 },
          }),
        );
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: txt, size: 22, font: "Calibri" })],
            bullet: { level: 0 },
            spacing: { after: 40 },
          }),
        );
      }
    });
  });

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${displayName.replace(/[^\w\s-]/g, "").trim()} - CVLingo.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Impact report PDF ──────────────────────────────────────────────────────────
function downloadImpactReport(data: PartnerDashboardData) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210; const ML = 20; const MR = 20; const CW = W - ML - MR;
  let y = 24;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(22); pdf.setTextColor(13, 110, 110);
  pdf.text("Monthly Impact Report", ML, y); y += 10;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(12); pdf.setTextColor(107, 114, 128);
  pdf.text(data.partner_name, ML, y); y += 6;
  pdf.text(currentMonthLabel(), ML, y); y += 14;

  const stats: [string, string][] = [
    ["CVs built this month", String(data.month_cvs)],
    ["Active users this month", String(data.active_this_month ?? 0)],
    ["Total CVs built", String(data.total_cvs)],
    ["Candidates in pool", String(data.total_candidates)],
  ];
  stats.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
    pdf.text(label + ":", ML, y);
    pdf.setFont("helvetica", "normal"); pdf.text(value, ML + 75, y);
    y += 8;
  });
  y += 6;

  const langs = Object.entries(data.lang_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (langs.length > 0) {
    pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 6;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
    pdf.text("Top Languages", ML, y); y += 8;
    langs.forEach(([lang, count]) => {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
      pdf.text(`${lang}: ${count}`, ML + 4, y); y += 6;
    });
    y += 6;
  }

  const jobs = Object.entries(data.job_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (jobs.length > 0) {
    pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 6;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
    pdf.text("Top Job Types", ML, y); y += 8;
    jobs.forEach(([job, count]) => {
      const txt = `${job}: ${count}`;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
      pdf.splitTextToSize(txt, CW - 4).forEach((line: string) => { pdf.text(line, ML + 4, y); y += 6; });
    });
  }

  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(170, 170, 170);
  pdf.text(`Generated by CVLingo · ${new Date().toLocaleDateString("en-GB")}`, W / 2, 285, { align: "center" });

  const safePartner = data.partner_name.replace(/[^\w\s-]/g, "").trim();
  pdf.save(`${safePartner} - CVLingo Impact Report - ${currentMonthLabel()}.pdf`);
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ── Breakdown bar ──────────────────────────────────────────────────────────────
function BreakdownBar({ label, items }: { label: string; items: Record<string, number> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) return null;
  const max = entries[0][1];
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="mb-4 text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{key}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QR download ────────────────────────────────────────────────────────────────
function QRDownloadButton({ url, partnerName }: { url: string; partnerName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function handleDownload() {
    const canvas = document.querySelector<HTMLCanvasElement>("#partner-qr canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${partnerName.toLowerCase().replace(/\s+/g, "-")}-cvlingo-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div id="partner-qr" className="rounded-xl bg-white p-3 shadow-sm">
        <QRCodeCanvas value={url} size={160} level="M" ref={canvasRef} />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        Download QR PNG
      </button>
    </div>
  );
}

// ── Owner-only: invite team member ─────────────────────────────────────────────
const MEMBER_CAP = 2;

function InviteTeamMember({
  partnerId,
  partnerName,
  memberCount,
}: {
  partnerId: string;
  partnerName: string;
  memberCount: number;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteError(null);
    setInviteSuccess(false);
    setInviting(true);
    try {
      const { error } = await supabase.rpc("invite_partner_member", {
        p_partner_id: partnerId,
        p_email: email,
      });
      if (error) {
        setInviteError(
          error.message.includes("already a member")
            ? "That email is already a team member."
            : error.message.includes("Only owners")
            ? "Only owners can invite team members."
            : error.message,
        );
        return;
      }
      void sendTeamInviteEmail(partnerName, email).catch((err: unknown) =>
        console.error("[team invite] email send failed", err),
      );
      setInviteEmail("");
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 5000);
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-6">
      <h2 className="mb-1 font-semibold text-foreground">Invite a team member</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Editors can view this dashboard. Only owners can invite others.
      </p>
      {memberCount >= MEMBER_CAP ? (
        <p className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          You've reached the team member limit ({MEMBER_CAP}) for now. Revoke an existing member to invite someone new.
        </p>
      ) : (
      <form onSubmit={(e) => void handleInvite(e)} className="flex flex-wrap gap-3">
        <input
          type="email"
          placeholder="colleague@example.org"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="flex-1 min-w-0 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim()}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
        >
          {inviting ? "Sending…" : "Send invite"}
        </button>
      </form>
      )}
      {inviteError && <p className="mt-2 text-sm text-destructive">{inviteError}</p>}
      {inviteSuccess && (
        <p className="mt-2 text-sm text-emerald-600 font-medium">
          Invite sent — they'll receive login instructions by email.
        </p>
      )}
    </div>
  );
}

// ── Client list table ──────────────────────────────────────────────────────────
function ClientTable({ clients }: { clients: PartnerClient[] }) {
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [downloadingWord, setDownloadingWord] = useState<string | null>(null);
  const [comingSoonToast, setComingSoonToast] = useState(false);

  function showComingSoon() {
    setComingSoonToast(true);
    setTimeout(() => setComingSoonToast(false), 3000);
  }

  async function handlePdf(client: PartnerClient) {
    if (!client.cv_english_html) return;
    setDownloadingPdf(client.candidate_id);
    try {
      downloadCvPdf(client.cv_english_html, client.display_name);
    } finally {
      setDownloadingPdf(null);
    }
  }

  async function handleWord(client: PartnerClient) {
    if (!client.cv_english_html) return;
    setDownloadingWord(client.candidate_id);
    try {
      await downloadCvDocx(client.cv_english_html, client.display_name);
    } catch (err) {
      console.error("[word export]", err);
    } finally {
      setDownloadingWord(null);
    }
  }

  if (clients.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card">
      {comingSoonToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background shadow-lg">
          Coming soon
        </div>
      )}
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-semibold text-foreground">Your clients ({clients.length})</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Candidates referred through your link. Names show first name and last initial only.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Language</th>
              <th className="px-4 py-2">Job types</th>
              <th className="px-4 py-2">Date joined</th>
              <th className="px-4 py-2">CV</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.candidate_id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{c.display_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.language}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.job_types.join(", ")}</td>
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(c.opted_in_at)}</td>
                <td className="px-4 py-2">
                  {c.has_cv ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Built</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not yet</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {c.has_cv && c.cv_english_html ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handlePdf(c)}
                          disabled={downloadingPdf === c.candidate_id}
                          className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          {downloadingPdf === c.candidate_id ? "…" : "PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleWord(c)}
                          disabled={downloadingWord === c.candidate_id}
                          className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          {downloadingWord === c.candidate_id ? "…" : "Word"}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No CV yet</span>
                    )}
                    <button
                      type="button"
                      onClick={showComingSoon}
                      className="rounded-lg border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function PartnerDashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }

    Promise.all([
      supabase.rpc("get_partner_dashboard_data"),
      supabase.rpc("get_partner_clients"),
    ]).then(([{ data: raw, error }, { data: clientsRaw, error: clientsErr }]) => {
      if (error) { setLoadError(error.message); return; }
      if (!raw) { navigate({ to: "/dashboard" }); return; }
      setData(raw as PartnerDashboardData);
      if (!clientsErr && Array.isArray(clientsRaw)) {
        setClients(clientsRaw as PartnerClient[]);
      }
    });
  }, [authLoading, user, navigate]);

  if (authLoading || (!data && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-5">
          <p className="text-sm text-destructive">Failed to load dashboard: {loadError}</p>
        </main>
        <Footer />
      </div>
    );
  }

  const referralUrl = `https://www.cvlingo.com/?ref=${data!.referral_code}`;

  function copyLink() {
    void navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Partner Dashboard</p>
            <h1 className="mt-1 font-serif text-3xl text-foreground md:text-4xl">{data!.partner_name}</h1>
            <p className="mt-1 text-xs text-muted-foreground capitalize">{data!.member_role}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Referral link + QR */}
        <div className="mb-8 rounded-2xl border border-border bg-card px-6 py-6">
          <p className="mb-3 text-sm font-semibold text-foreground">Your referral link</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
                <span className="flex-1 truncate font-mono text-sm text-foreground">{referralUrl}</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Share this link with your members — CVs they build will be tracked here.
              </p>
            </div>
            <QRDownloadButton url={referralUrl} partnerName={data!.partner_name} />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total CVs built" value={data!.total_cvs} />
          <StatCard label={`CVs in ${currentMonthLabel()}`} value={data!.month_cvs} />
          <StatCard label="Active this month" value={data!.active_this_month ?? 0} />
          <StatCard label="Candidates in pool" value={data!.total_candidates} />
        </div>

        {/* Monthly impact summary + Download Report */}
        <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-primary">Monthly impact</p>
              <p className="mt-1 text-sm text-foreground">{impactSummary(data!)}</p>
            </div>
            <button
              type="button"
              onClick={() => downloadImpactReport(data!)}
              className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Download Report PDF
            </button>
          </div>
        </div>

        {/* Breakdowns */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <BreakdownBar label="Languages" items={data!.lang_breakdown} />
          <BreakdownBar label="Job types" items={data!.job_breakdown} />
        </div>

        {/* Client list with PDF/Word download */}
        <ClientTable clients={clients} />

        {clients.length === 0 && data!.total_cvs === 0 && (
          <div className="mb-8 rounded-2xl border border-border bg-card px-6 py-10 text-center">
            <p className="font-medium text-foreground">No activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your referral link to start tracking CVs and candidates.
            </p>
          </div>
        )}

        {/* Owner-only: invite team member */}
        {data!.member_role === "owner" && (
          <InviteTeamMember
            partnerId={data!.partner_id}
            partnerName={data!.partner_name}
            memberCount={data!.member_count}
          />
        )}
      </main>

      <div className="text-center py-4">
        <ObfuscatedEmail
          subject="CVLingo Support Request"
          className="text-sm text-gray-500 hover:text-primary transition-colors"
        >
          Need help? Contact us
        </ObfuscatedEmail>
      </div>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute("/partner/dashboard")({
  codeSplitGroupings: [],
  component: PartnerDashboardPage,
});
