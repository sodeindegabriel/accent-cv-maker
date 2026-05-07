import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { Globe, MessageCircle, FileDown, Check, ArrowRight, Clock } from "lucide-react";

const chooseLangPhrases: { text: string; dir: "ltr" | "rtl"; lang: string }[] = [
  { text: "اختر لغتك", dir: "rtl", lang: "ar" },
  { text: "اپنی زبان منتخب کریں", dir: "rtl", lang: "ur" },
  { text: "Dooro luqaddaada", dir: "ltr", lang: "so" },
  { text: "Wybierz swój język", dir: "ltr", lang: "pl" },
  { text: "Alege limba ta", dir: "ltr", lang: "ro" },
  { text: "Elige tu idioma", dir: "ltr", lang: "es" },
  { text: "Choisissez votre langue", dir: "ltr", lang: "fr" },
  { text: "अपनी भाषा चुनें", dir: "ltr", lang: "hi" },
];

export const Route = createFileRoute("/")({
  component: Index,
});

// Flags map to language codes supported in /build
const heroFlags: { flag: string; code: string; name: string }[] = [
  { flag: "🇸🇦", code: "ar", name: "Arabic" },
  { flag: "🇵🇰", code: "ur", name: "Urdu" },
  { flag: "🇸🇴", code: "so", name: "Somali" },
  { flag: "🇵🇱", code: "pl", name: "Polish" },
  { flag: "🇷🇴", code: "ro", name: "Romanian" },
  { flag: "🇧🇩", code: "bn", name: "Bengali" },
  { flag: "🇮🇳", code: "hi", name: "Hindi" },
  { flag: "🇫🇷", code: "fr", name: "French" },
  { flag: "🇪🇸", code: "es", name: "Spanish" },
  { flag: "🇹🇷", code: "tr", name: "Turkish" },
  { flag: "🇨🇳", code: "zh", name: "Chinese" },
  { flag: "🇰🇪", code: "sw", name: "Swahili" },
  { flag: "🇳🇬", code: "yo", name: "Yoruba" },
  { flag: "🇳🇬", code: "ig", name: "Igbo" },
  { flag: "🇪🇹", code: "om", name: "Oromo" },
  { flag: "🇨🇩", code: "ln", name: "Lingala" },
];

const languages: { flag: string; en: string; native: string; code: string }[] = [
  { flag: "🇸🇦", en: "Arabic", native: "عربي", code: "ar" },
  { flag: "🇵🇰", en: "Urdu", native: "اردو", code: "ur" },
  { flag: "🇸🇴", en: "Somali", native: "Soomaali", code: "so" },
  { flag: "🇵🇱", en: "Polish", native: "Polski", code: "pl" },
  { flag: "🇷🇴", en: "Romanian", native: "Română", code: "ro" },
  { flag: "🇧🇩", en: "Bengali", native: "বাংলা", code: "bn" },
  { flag: "🇮🇳", en: "Hindi", native: "हिंदी", code: "hi" },
  { flag: "🇫🇷", en: "French", native: "Français", code: "fr" },
  { flag: "🇪🇸", en: "Spanish", native: "Español", code: "es" },
  { flag: "🇹🇷", en: "Turkish", native: "Türkçe", code: "tr" },
  { flag: "🇨🇳", en: "Mandarin", native: "普通话", code: "zh" },
  { flag: "🇰🇪", en: "Swahili", native: "Kiswahili", code: "sw" },
  { flag: "🇺🇦", en: "Ukrainian", native: "Українська", code: "uk" },
  { flag: "🇵🇹", en: "Portuguese", native: "Português", code: "pt" },
  { flag: "🇮🇷", en: "Farsi", native: "فارسی", code: "fa" },
  { flag: "🇬🇧", en: "English", native: "English", code: "en" },
  { flag: "🇳🇬", en: "Yoruba", native: "Yorùbá", code: "yo" },
  { flag: "🇳🇬", en: "Igbo", native: "Igbo", code: "ig" },
  { flag: "🇪🇹", en: "Oromo", native: "Afaan Oromoo", code: "om" },
  { flag: "🇨🇩", en: "Lingala", native: "Lingála", code: "ln" },
];

const steps = [
  {
    icon: Globe,
    title: "Choose your language",
    desc: "Pick from 20 languages — we meet you where you are, no English required to get started.",
  },
  {
    icon: MessageCircle,
    title: "Answer simple questions",
    desc: "Tell us about your work history, skills, and goals in your own words, at your own pace.",
  },
  {
    icon: FileDown,
    title: "Download your CV",
    desc: "Get a polished, UK-format CV ready to send to employers — instantly, for free.",
  },
];

function Index() {
  const navigate = useNavigate();
  const [phraseIndex, setPhraseIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % chooseLangPhrases.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);
  const pickLanguage = (code: string) => {
    try {
      sessionStorage.setItem("cvlingo:preselectLanguage", code);
    } catch {
      /* ignore */
    }
    navigate({ to: "/build" });
  };
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* HERO */}
        <section className="topo-bg relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-5 pt-12 pb-20 md:pt-20 md:pb-28">
            <div className="mx-auto max-w-3xl text-center">
              <div
                className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-1.5 text-xs font-medium text-foreground backdrop-blur"
                style={{ animationDelay: "0ms" }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Free for UK jobseekers
              </div>

              <h1
                className="mt-6 animate-fade-in font-serif text-[42px] leading-[1.05] text-foreground md:text-[72px]"
                style={{ animationDelay: "100ms" }}
              >
                Your skills deserve
                <br />
                to be heard.
              </h1>

              <p
                className="mt-4 animate-fade-in font-serif text-2xl italic text-primary md:text-3xl"
                style={{ animationDelay: "200ms" }}
              >
                We'll write your CV in your language.
              </p>

              <p
                className="mx-auto mt-6 max-w-xl animate-fade-in text-base text-muted-foreground md:text-lg"
                style={{ animationDelay: "300ms" }}
              >
                Answer a few simple questions in your language. We create a professional UK CV for you — free, in
                minutes.
              </p>

              <div
                className="mt-8 flex animate-fade-in flex-col items-center justify-center gap-3 sm:flex-row"
                style={{ animationDelay: "400ms" }}
              >
                <button
                  type="button"
                  onClick={() => pickLanguage("en")}
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg sm:w-auto"
                >
                  Start in English
                </button>
                <Link
                  to="/build"
                  dir={chooseLangPhrases[phraseIndex].dir}
                  lang={chooseLangPhrases[phraseIndex].lang}
                  key={chooseLangPhrases[phraseIndex].lang}
                  className="inline-flex w-full animate-fade-in items-center justify-center rounded-full border-2 border-primary bg-transparent px-7 py-3 text-base font-semibold text-primary transition-all hover:bg-primary/5 sm:w-auto"
                >
                  {chooseLangPhrases[phraseIndex].text}
                </Link>
              </div>

              <div
                className="mt-12 animate-fade-in"
                style={{ animationDelay: "500ms" }}
              >
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Available in 20 languages
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {heroFlags.map((f) => (
                    <button
                      key={f.code}
                      type="button"
                      onClick={() => pickLanguage(f.code)}
                      aria-label={`Start in ${f.name}`}
                      title={`Start in ${f.name}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xl shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span aria-hidden="true">{f.flag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="bg-background py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal className="text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-accent">Simple Process</span>
              <h2 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
                Three steps to your new job
              </h2>
            </Reveal>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <Reveal
                    key={s.title}
                    delay={i * 120}
                    className="group rounded-2xl bg-secondary p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                        <Icon className="h-7 w-7" />
                      </div>
                      <span className="font-serif text-2xl text-accent">0{i + 1}</span>
                    </div>
                    <h3 className="mt-6 font-serif text-2xl text-foreground">{s.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">{s.desc}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="bg-primary py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 text-center md:grid-cols-3">
            <div>
              <div className="font-serif text-5xl text-white md:text-6xl">
                <CountUp value={20} />
              </div>
              <p className="mt-2 text-sm uppercase tracking-widest text-white/70">Languages Supported</p>
            </div>
            <div>
              <div className="font-serif text-5xl text-white md:text-6xl">
                <CountUp value={100} suffix="%" />
              </div>
              <p className="mt-2 text-sm uppercase tracking-widest text-white/70">Free for Jobseekers</p>
            </div>
            <div>
              <div className="font-serif text-5xl text-white md:text-6xl">UK Format</div>
              <p className="mt-2 text-sm uppercase tracking-widest text-white/70">Job Market Ready</p>
            </div>
          </div>
        </section>

        {/* LANGUAGES */}
        <section id="languages" className="bg-background py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-accent">Multilingual</span>
              <h2 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
                Build your CV in your language
              </h2>
              <p className="mt-4 text-muted-foreground">
                No matter where you're from, we have you covered. More languages are added regularly.
              </p>
            </Reveal>

            <div className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-4">
              {languages.map((l, i) => (
                <Reveal key={l.en} delay={i * 30}>
                  <button
                    type="button"
                    onClick={() => pickLanguage(l.code)}
                    aria-label={`Start in ${l.en}`}
                    className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="text-3xl" aria-hidden="true">{l.flag}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{l.en}</p>
                      <p className="truncate font-semibold text-foreground">{l.native}</p>
                    </div>
                  </button>
                </Reveal>
              ))}
              <Reveal delay={languages.length * 30}>
                <div
                  aria-disabled="true"
                  className="flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/40 p-4 text-left opacity-70"
                >
                  <Clock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">More languages</p>
                    <p className="truncate font-semibold text-muted-foreground">coming soon…</p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* EMPLOYER TEASER */}
        <section className="bg-background pb-24">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal className="overflow-hidden rounded-3xl shadow-xl">
              <div className="grid md:grid-cols-2">
                {/* Left */}
                <div className="relative overflow-hidden bg-primary p-10 md:p-14">
                  <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
                  <div className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-white/5" />
                  <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5" />
                  <div className="relative flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                    <span className="text-7xl" aria-hidden="true">🤝</span>
                    <p className="mt-6 font-serif text-2xl italic text-white md:text-3xl">
                      "The right person for the job."
                    </p>
                  </div>
                </div>
                {/* Right */}
                <div className="bg-primary-soft p-10 md:p-14">
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">For Employers</span>
                  <h2 className="mt-3 font-serif text-3xl text-foreground md:text-4xl">
                    Hiring for hands-on roles?
                  </h2>
                  <p className="mt-4 text-foreground/80">
                    Many of the UK's hardest working people can't write a CV in English — but they can do the job.
                    CVLingo gives you access to a pre-vetted pool of motivated candidates ready to work.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {[
                      "Pre-vetted, motivated candidates",
                      "Hands-on roles filled faster",
                      "Diverse talent pool",
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="text-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/employer"
                    className="group mt-8 inline-flex items-center gap-2 font-semibold text-primary"
                  >
                    Learn more for employers
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
