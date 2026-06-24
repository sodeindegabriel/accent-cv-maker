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

function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-background">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 lg:px-8">

          <div className="mb-10 border-b border-border pb-8">
            <h1 className="font-serif text-4xl text-foreground">Terms of Service</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>
          </div>

          <div className="space-y-10">

            <Section title="1. Acceptance of Terms">
              <p>By using CVLingo (cvlingo.com) you agree to these Terms of Service. If you do not agree, please do not use the platform.</p>
              <p>CVLingo is operated by Jebaco Global, a UK registered company.</p>
            </Section>

            <Section title="2. The Service">
              <p>CVLingo provides a free AI-powered CV building service for job seekers, particularly immigrants and non-English speakers in the United Kingdom.</p>
              <p>The service allows users to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Build a professional UK-format CV in their native language</li>
                <li>Download their CV as a PDF</li>
                <li>Optionally join a candidate pool visible to employers</li>
              </ul>
            </Section>

            <Section title="3. Free for Job Seekers">
              <p>CVLingo is and will always be free for individual job seekers. We do not charge job seekers for CV generation, download, or basic platform features.</p>
            </Section>

            <Section title="4. User Responsibilities">
              <p>By using CVLingo you agree to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Provide accurate and truthful information</li>
                <li>Not misrepresent your identity, qualifications or work experience</li>
                <li>Not use CVLingo to create fraudulent CVs</li>
                <li>Not attempt to access, disrupt or damage our platform or servers</li>
                <li>Comply with all applicable UK laws</li>
              </ul>
            </Section>

            <Section title="5. Intellectual Property">
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>CVs generated through CVLingo belong to the user who created them</li>
                <li>The CVLingo name, logo, platform design and technology are owned by Jebaco Global</li>
                <li>You may not copy, reproduce or distribute any part of the CVLingo platform without written permission</li>
              </ul>
            </Section>

            <Section title="6. Candidate Pool">
              <p>If you choose to join our candidate pool:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>You consent to your CV profile being visible to employers using CVLingo</li>
                <li>You can withdraw from the candidate pool at any time by contacting us</li>
                <li>CVLingo does not guarantee job placement or employer contact</li>
              </ul>
            </Section>

            <Section title="7. Employer Terms">
              <p>Employers accessing the CVLingo candidate pool agree to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Use candidate data only for legitimate recruitment purposes</li>
                <li>Not share candidate data with third parties</li>
                <li>Comply with UK employment law including the Equality Act 2010</li>
                <li>Not discriminate against candidates based on protected characteristics</li>
              </ul>
            </Section>

            <Section title="8. Limitations of Liability">
              <p>CVLingo provides CV generation as a tool. We do not guarantee:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Employment outcomes or job placements</li>
                <li>That your CV will be accepted by any specific employer</li>
                <li>Uninterrupted availability of the platform</li>
              </ul>
              <p>Our liability is limited to the maximum extent permitted by UK law.</p>
            </Section>

            <Section title="9. AI Generated Content">
              <p>CVs are generated using artificial intelligence. While we strive for accuracy:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>You are responsible for reviewing your CV before submitting it to employers</li>
                <li>You should verify all content is accurate</li>
                <li>CVLingo is not liable for any inaccuracies in AI generated content</li>
              </ul>
            </Section>

            <Section title="10. Platform Availability">
              <p>We aim to keep CVLingo available at all times but do not guarantee uninterrupted service. We reserve the right to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Update or modify the platform</li>
                <li>Temporarily suspend service for maintenance</li>
                <li>Discontinue features with reasonable notice</li>
              </ul>
            </Section>

            <Section title="11. Governing Law">
              <p>These terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
            </Section>

            <Section title="12. Changes to Terms">
              <p>We may update these terms from time to time. Continued use of CVLingo after changes constitutes acceptance of the updated terms.</p>
            </Section>

            <Section title="13. Contact">
              <p>For any queries about these terms:</p>
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

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — CVLingo" },
      { name: "description", content: "Terms and conditions for using CVLingo. Free AI-powered CV builder for UK job seekers and immigrants." },
    ],
    links: [{ rel: "canonical", href: "https://cvlingo.com/terms" }],
  }),
});
