import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 bg-background">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 lg:px-8">

          <div className="mb-10 border-b border-border pb-8">
            <h1 className="font-serif text-4xl text-foreground">About the Founders</h1>
          </div>

          <div className="space-y-6 text-base leading-relaxed text-foreground/90">
            <p>
              CVLingo was founded by Ezinwa Idogbe and Gabriel Sodeinde — a Business Analyst and a
              Software Engineer who came together around a problem Ezinwa had watched play out for
              years inside the UK employment support system.
            </p>

            <p>
              Ezinwa spent years working within the Department for Work and Pensions, supporting
              people on their journey back into employment. Day after day, she watched skilled,
              motivated, work-ready individuals get left behind — not because they lacked ability,
              but because they could not write a CV in English. She started with a paper template.
              A structured, guided document that helped non-English speakers capture their experience
              in a format UK employers could understand. The results were immediate — a 20% increase
              in job starts among the clients who used it.
            </p>

            <p>
              She brought the idea to Gabriel Sodeinde, a software engineer and product architect
              with over 10 years of experience building digital products. Gabriel took the concept
              and built it into a fully working platform — the AI pipeline, 21 languages, the
              candidate pool, the employer matching system, the PDF engine — everything. Built
              entirely in-house, without any external agency, from the ground up.
            </p>

            <p>CVLingo is what that paper template became.</p>

            <p>
              Today CVLingo supports 21 languages and has helped hundreds of jobseekers build
              professional, UK-standard CVs — free, in their own language, in minutes. The platform
              is built on one belief: that language should never be the reason someone cannot find
              work.
            </p>

            <p>Ezinwa and Gabriel built CVLingo to change that. One CV at a time.</p>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About the Founders | CVLingo" },
      {
        name: "description",
        content:
          "CVLingo was founded by Ezinwa Idogbe and Gabriel Sodeinde to help non-English speakers build professional UK CVs — born from a 20% increase in job starts using a paper template inside the DWP.",
      },
      { property: "og:title", content: "About the Founders | CVLingo" },
      {
        property: "og:description",
        content:
          "CVLingo was founded by Ezinwa Idogbe and Gabriel Sodeinde to help non-English speakers build professional UK CVs — born from a 20% increase in job starts using a paper template inside the DWP.",
      },
    ],
  }),
});
