import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ObfuscatedEmail } from "@/components/ObfuscatedEmail";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-background">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 lg:px-8">

          <div className="mb-10 border-b border-border pb-8">
            <h1 className="font-serif text-4xl text-foreground">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: November 2026</p>
          </div>

          <div className="space-y-10">

            <Section title="1. Who We Are">
              <p>
                CVLingo is operated by Jebaco Global Ltd, a UK registered company. We are committed to protecting your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <div className="mt-2 space-y-1">
                <p><span className="font-medium">Contact:</span>{" "}<ObfuscatedEmail className="text-primary hover:underline" /></p>
                <p><span className="font-medium">Website:</span> cvlingo.com</p>
              </div>
            </Section>

            <Section title="2. What Data We Collect">
              <p>We collect the following personal data when you use CVLingo:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Full name</li>
                <li>Phone number</li>
                <li>Email address</li>
                <li>City and postcode</li>
                <li>Work experience and employment history</li>
                <li>Skills and qualifications</li>
                <li>Education history</li>
                <li>Right to work status</li>
                <li>Language preference</li>
                <li>Job type preferences</li>
                <li>Availability</li>
              </ul>
              <p className="mt-3">We also collect:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Which partner organisation referred you to CVLingo, and whether you chose to share your data with them</li>
                <li>Cover letters you write using CVLingo</li>
                <li>Timestamp of when you used the platform</li>
                <li>Device and browser information (standard analytics data)</li>
              </ul>
            </Section>

            <Section title="3. How We Use Your Data">
              <p>We use your personal data to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Generate your professional UK CV</li>
                <li>Add you to our candidate pool if you choose to opt in</li>
                <li>Connect you with potential employers who are looking for candidates like you</li>
                <li>If you reach CVLingo through a partner organisation's link, we show that organisation your first name and last initial, the date you joined, your CV language and whether you have built a CV, so their advisers can follow up with the people they referred (see 'Sharing with a partner organisation' below).</li>
                <li>Improve our platform and services</li>
                <li>Communicate with you about your CV and job opportunities</li>
              </ul>
              <p className="mt-3">When you build a CV or cover letter, your answers are sent to Anthropic (our AI provider) to generate the text. Anthropic processes this data on our behalf under a data processing agreement and does not use it to train their models.</p>
              <p className="mt-3 font-medium">We do NOT:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Sell your data to third parties</li>
                <li>Share your CV or cover letters with a referring partner organisation unless you choose to share them (when you sign up, or later from your dashboard)</li>
                <li>Use your data for advertising purposes</li>
                <li>Transfer your data outside the UK without a recognised safeguard in place</li>
              </ul>
              <p className="mt-3">We keep a record of partner case activity, for example when a case is assigned, closed or reopened, and when partner staff edit a cover letter. This helps us keep your information handled accountably.</p>
            </Section>

            <Section title="4. Legal Basis for Processing">
              <p>We process your personal data under the following legal bases:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">Contract:</span> To deliver the CV generation service you have requested</li>
                <li><span className="font-medium">Legitimate interests:</span> To operate and improve our platform, and to share basic referral details (that you signed up and used the service) with the partner organisation that referred you</li>
                <li><span className="font-medium">Consent:</span> You provide your information voluntarily to generate your CV. If you arrived via a partner link, we ask separately whether you want to share your CV and cover letters with that partner — we do this only if you tick the box</li>
                <li><span className="font-medium">Consent:</span> To add you to our candidate pool visible to employers (optional — you choose this separately)</li>
              </ul>
            </Section>

            <Section title="5. Children and Age">
              <p>We do not knowingly collect personal data from anyone under 18, and we do not ask for dates of birth. If you are a parent or carer and think a child has used CVLingo, contact us at{" "}<ObfuscatedEmail className="text-primary hover:underline" /> and we will delete the account.</p>
            </Section>

            <Section title="6. Data Storage and Security">
              <p>Your account, CVs and cover letters are stored securely in our database, which is provided by Supabase. We use technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure or destruction. Some of our service providers (listed in section 12) may process data outside the UK, including in the United States. Where that happens, we rely on recognised safeguards, such as the UK International Data Transfer Agreement or Addendum, or the UK-US data bridge, to protect your data.</p>
            </Section>

            <Section title="7. How Long We Keep Your Data">
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">Your account, CVs and cover letters:</span> kept until you ask us to delete them. You can ask at any time at{" "}<ObfuscatedEmail className="text-primary hover:underline" /> and we will delete them.</li>
                <li><span className="font-medium">Candidate pool data:</span> kept for up to 2 years or until you ask us to delete it.</li>
                <li><span className="font-medium">Records of partner case activity:</span> kept while the partnership with that organisation continues.</li>
              </ul>
            </Section>

            <Section title="8. Your Rights Under UK GDPR">
              <p>You have the following rights:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">Right to access:</span> Request a copy of the personal data we hold about you</li>
                <li><span className="font-medium">Right to rectification:</span> Request correction of inaccurate data</li>
                <li><span className="font-medium">Right to erasure:</span> Request deletion of your personal data</li>
                <li><span className="font-medium">Right to restrict processing:</span> Request that we limit how we use your data</li>
                <li><span className="font-medium">Right to data portability:</span> Request your data in a portable format</li>
                <li><span className="font-medium">Right to object:</span> Object to our processing of your personal data, including where we rely on legitimate interests (such as sharing basic referral details with a partner organisation)</li>
                <li><span className="font-medium">Right to withdraw consent:</span> Withdraw consent at any time</li>
              </ul>
              <p>To exercise any of these rights, contact us at{" "}<ObfuscatedEmail className="text-primary hover:underline" />. We will respond within 30 days.</p>
            </Section>

            <Section title="9. Candidate Pool">
              <p>If you choose to join our candidate pool:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Your CV and contact details may be shared with employers who are actively hiring for roles that match your profile</li>
                <li>You will only be contacted by employers through CVLingo — we never share your direct contact details without your explicit consent</li>
                <li>You can request removal from the candidate pool at any time by emailing{" "}<ObfuscatedEmail className="text-primary hover:underline" /></li>
              </ul>
            </Section>

            <Section title="10. Sharing with a Partner Organisation">
              <p>If you arrived at CVLingo through a partner link (from a charity, job centre, community organisation or similar), that organisation can see your first name and last initial, the date you joined, your CV language and whether you have built a CV. This is basic referral tracking, and it is part of our legitimate interest in supporting the people the organisation has referred. You can object at any time by contacting us.</p>
              <p>We will only show the partner your CV and cover letters if you choose to share them, when you sign up or later from your dashboard. If you share, their advisers can view, download and edit your CV and cover letters to help you. Changes to cover letters are recorded. You can switch sharing off at any time on your dashboard and their access stops immediately. This is separate from the employer candidate pool.</p>
              <p>Within a partner organisation, access is limited to the team members who need it: managers can see the organisation's referred clients, and other team members see only the clients assigned to them. We keep a record of case assignments, closures and cover letter edits.</p>
              <p>If you want to know exactly what a particular partner can see, or to withdraw your sharing, contact us at{" "}<ObfuscatedEmail className="text-primary hover:underline" />.</p>
            </Section>

            <Section title="11. Cookies">
              <p>We use essential cookies only to keep the platform functioning correctly. We do not use tracking, advertising, or analytics cookies without your consent.</p>
            </Section>

            <Section title="12. Third Party Services">
              <p>We use the following third party services:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">Supabase:</span> our database and sign-in service, where your account, CVs and cover letters are stored.</li>
                <li><span className="font-medium">Anthropic (Claude API):</span> to generate CV and cover letter content. Your data is sent to Anthropic under a data processing agreement.</li>
                <li><span className="font-medium">Vercel:</span> to host and deliver the website.</li>
                <li><span className="font-medium">Resend:</span> to send emails such as sign-in codes and team invitations. They process the email address and the content of those emails.</li>
                <li><span className="font-medium">EmailJS:</span> to send email notifications. The email address and message content pass through them.</li>
              </ul>
            </Section>

            <Section title="13. Complaints">
              <p>If you are unhappy with how we handle your personal data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO):</p>
              <div className="mt-2 space-y-1">
                <p><span className="font-medium">Website:</span>{" "}<a href="https://ico.org.uk" target="_blank" rel="noreferrer" className="text-primary hover:underline">ico.org.uk</a></p>
                <p><span className="font-medium">Phone:</span> 0303 123 1113</p>
              </div>
            </Section>

            <Section title="14. Changes to This Policy">
              <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date. Continued use of CVLingo after changes constitutes acceptance of the new policy.</p>
            </Section>

            <Section title="15. Contact Us">
              <p>For any privacy related queries:</p>
              <div className="mt-2 space-y-1">
                <p><span className="font-medium">Email:</span>{" "}<ObfuscatedEmail className="text-primary hover:underline" /></p>
                <p><span className="font-medium">Website:</span> cvlingo.com</p>
              </div>
            </Section>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — CVLingo" },
      { name: "description", content: "CVLingo privacy policy. How we collect, use and protect your personal data in accordance with UK GDPR and the Data Protection Act 2018." },
    ],
    links: [{ rel: "canonical", href: "https://cvlingo.com/privacy" }],
  }),
});
