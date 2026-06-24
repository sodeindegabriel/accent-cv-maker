import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

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
            <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>
          </div>

          <div className="space-y-10">

            <Section title="1. Who We Are">
              <p>
                CVLingo is operated by Jebaco Global, a UK registered company. We are committed to protecting your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
              <div className="mt-2 space-y-1">
                <p><span className="font-medium">Contact:</span>{" "}<a href="mailto:hello@jebacoglobal.com" className="text-primary hover:underline">hello@jebacoglobal.com</a></p>
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
                <li>Referral source (which organisation referred you to CVLingo)</li>
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
                <li>Improve our platform and services</li>
                <li>Communicate with you about your CV and job opportunities</li>
              </ul>
              <p className="mt-3 font-medium">We do NOT:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Sell your data to third parties</li>
                <li>Share your data without your consent</li>
                <li>Use your data for advertising purposes</li>
                <li>Transfer your data outside the UK without appropriate safeguards</li>
              </ul>
            </Section>

            <Section title="4. Legal Basis for Processing">
              <p>We process your personal data under the following legal bases:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">Consent:</span> You provide your information voluntarily to generate your CV and optionally join our candidate pool</li>
                <li><span className="font-medium">Legitimate interests:</span> To operate and improve our platform</li>
                <li><span className="font-medium">Contract:</span> To deliver the CV generation service you have requested</li>
              </ul>
            </Section>

            <Section title="5. Data Storage and Security">
              <p>Your CV data is processed in real time to generate your CV. If you join our candidate pool, your data is stored securely on our servers.</p>
              <p>We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure or destruction.</p>
              <p>Your data is stored on secure UK/EU servers and is never transferred to countries without adequate data protection laws.</p>
            </Section>

            <Section title="6. How Long We Keep Your Data">
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">CV generation data:</span> processed in real time and not permanently stored unless you join the candidate pool</li>
                <li><span className="font-medium">Candidate pool data:</span> retained for up to 2 years or until you request deletion</li>
                <li><span className="font-medium">Partner organisation data:</span> retained for the duration of the partnership</li>
              </ul>
            </Section>

            <Section title="7. Your Rights Under UK GDPR">
              <p>You have the following rights:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">Right to access:</span> Request a copy of the personal data we hold about you</li>
                <li><span className="font-medium">Right to rectification:</span> Request correction of inaccurate data</li>
                <li><span className="font-medium">Right to erasure:</span> Request deletion of your personal data</li>
                <li><span className="font-medium">Right to restrict processing:</span> Request that we limit how we use your data</li>
                <li><span className="font-medium">Right to data portability:</span> Request your data in a portable format</li>
                <li><span className="font-medium">Right to object:</span> Object to our processing of your personal data</li>
                <li><span className="font-medium">Right to withdraw consent:</span> Withdraw consent at any time</li>
              </ul>
              <p>To exercise any of these rights, contact us at{" "}<a href="mailto:hello@jebacoglobal.com" className="text-primary hover:underline">hello@jebacoglobal.com</a>. We will respond within 30 days.</p>
            </Section>

            <Section title="8. Candidate Pool">
              <p>If you choose to join our candidate pool:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Your CV and contact details may be shared with employers who are actively hiring for roles that match your profile</li>
                <li>You will only be contacted by employers through CVLingo — we never share your direct contact details without your explicit consent</li>
                <li>You can request removal from the candidate pool at any time by emailing{" "}<a href="mailto:hello@jebacoglobal.com" className="text-primary hover:underline">hello@jebacoglobal.com</a></li>
              </ul>
            </Section>

            <Section title="9. Cookies">
              <p>We use essential cookies only to keep the platform functioning correctly. We do not use tracking, advertising, or analytics cookies without your consent.</p>
            </Section>

            <Section title="10. Third Party Services">
              <p>We use the following third party services:</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><span className="font-medium">Anthropic Claude API:</span> To generate CV content (your data is processed but not stored by Anthropic)</li>
                <li><span className="font-medium">EmailJS:</span> To send email notifications (no personal data is stored by EmailJS)</li>
                <li><span className="font-medium">Vercel:</span> For hosting and deployment</li>
              </ul>
            </Section>

            <Section title="11. Complaints">
              <p>If you are unhappy with how we handle your personal data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO):</p>
              <div className="mt-2 space-y-1">
                <p><span className="font-medium">Website:</span>{" "}<a href="https://ico.org.uk" target="_blank" rel="noreferrer" className="text-primary hover:underline">ico.org.uk</a></p>
                <p><span className="font-medium">Phone:</span> 0303 123 1113</p>
              </div>
            </Section>

            <Section title="12. Changes to This Policy">
              <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date. Continued use of CVLingo after changes constitutes acceptance of the new policy.</p>
            </Section>

            <Section title="13. Contact Us">
              <p>For any privacy related queries:</p>
              <div className="mt-2 space-y-1">
                <p><span className="font-medium">Email:</span>{" "}<a href="mailto:hello@jebacoglobal.com" className="text-primary hover:underline">hello@jebacoglobal.com</a></p>
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
