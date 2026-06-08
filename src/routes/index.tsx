import { createFileRoute, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { Globe, MessageCircle, FileDown, Check, ArrowRight, Clock, Lock, Play, X } from "lucide-react";

type CVTranslation = {
  dir: "ltr" | "rtl";
  contact: { phone: string; email: string; location: string };
  summaryHeading: string;
  summary: string;
  experienceHeading: string;
  jobTitle: string;
  jobDates: string;
  employer: string;
  bullets: string[];
  skillsHeading: string;
  skills: string[];
  educationHeading: string;
  degree: string;
  school: string;
  languagesHeading: string;
  languagesText: string;
};

const cvTranslations: Record<string, CVTranslation> = {
  en: {
    dir: "ltr",
    contact: { phone: "+44 7700 900123", email: "amina.hussain@email.com", location: "Birmingham, UK" },
    summaryHeading: "Professional Summary",
    summary:
      "Dedicated healthcare assistant with 4+ years of experience in residential and hospital care settings. Compassionate, reliable, and committed to delivering high-quality patient support. Seeking a new opportunity to grow within the UK healthcare sector.",
    experienceHeading: "Work Experience",
    jobTitle: "Healthcare Assistant",
    jobDates: "2020 – Present",
    employer: "Greenwood Care Home, Birmingham, UK",
    bullets: [
      "Provided daily personal care to 8+ residents, maintaining dignity and comfort",
      "Assisted with medication reminders and mobility support",
      "Collaborated with nurses and families to update care plans",
    ],
    skillsHeading: "Key Skills",
    skills: ["Patient Care", "Teamwork", "Communication", "First Aid", "Time Management"],
    educationHeading: "Education",
    degree: "NVQ Level 2 in Health and Social Care",
    school: "Birmingham Adult Education, 2019",
    languagesHeading: "Languages",
    languagesText: "English (Fluent) · Urdu (Native)",
  },
  pl: {
    dir: "ltr",
    contact: { phone: "+44 7700 900123", email: "amina.hussain@email.com", location: "Birmingham, Wielka Brytania" },
    summaryHeading: "Profil zawodowy",
    summary:
      "Zaangażowana asystentka opieki zdrowotnej z ponad 4-letnim doświadczeniem w domach opieki i szpitalach. Wyrozumiała, niezawodna i oddana wysokiej jakości opiece nad pacjentami. Poszukuję nowej szansy rozwoju w brytyjskim sektorze opieki zdrowotnej.",
    experienceHeading: "Doświadczenie zawodowe",
    jobTitle: "Asystentka opieki zdrowotnej",
    jobDates: "2020 – obecnie",
    employer: "Greenwood Care Home, Birmingham, Wielka Brytania",
    bullets: [
      "Zapewniałam codzienną opiekę osobistą ponad 8 pensjonariuszom, dbając o ich godność i komfort",
      "Pomagałam w przypomnieniach o lekach i wsparciu w poruszaniu się",
      "Współpracowałam z pielęgniarkami i rodzinami przy aktualizacji planów opieki",
    ],
    skillsHeading: "Kluczowe umiejętności",
    skills: ["Opieka nad pacjentem", "Praca w zespole", "Komunikacja", "Pierwsza pomoc", "Zarządzanie czasem"],
    educationHeading: "Wykształcenie",
    degree: "NVQ Poziom 2 w zakresie opieki zdrowotnej i społecznej",
    school: "Birmingham Adult Education, 2019",
    languagesHeading: "Języki",
    languagesText: "Angielski (biegle) · Urdu (ojczysty)",
  },
  ar: {
    dir: "rtl",
    contact: { phone: "+44 7700 900123", email: "amina.hussain@email.com", location: "برمنغهام، المملكة المتحدة" },
    summaryHeading: "الملخص المهني",
    summary:
      "مساعدة رعاية صحية متفانية تتمتع بخبرة تزيد عن 4 سنوات في دور الرعاية والمستشفيات. متعاطفة، موثوقة، وملتزمة بتقديم دعم عالي الجودة للمرضى. أبحث عن فرصة جديدة للنمو في قطاع الرعاية الصحية بالمملكة المتحدة.",
    experienceHeading: "الخبرة العملية",
    jobTitle: "مساعدة رعاية صحية",
    jobDates: "2020 – حتى الآن",
    employer: "دار رعاية غرينوود، برمنغهام، المملكة المتحدة",
    bullets: [
      "تقديم الرعاية الشخصية اليومية لأكثر من 8 مقيمين مع الحفاظ على كرامتهم وراحتهم",
      "المساعدة في تذكير الأدوية ودعم التنقل",
      "التعاون مع الممرضات والعائلات لتحديث خطط الرعاية",
    ],
    skillsHeading: "المهارات الرئيسية",
    skills: ["رعاية المرضى", "العمل الجماعي", "التواصل", "الإسعافات الأولية", "إدارة الوقت"],
    educationHeading: "التعليم",
    degree: "NVQ المستوى 2 في الصحة والرعاية الاجتماعية",
    school: "تعليم الكبار في برمنغهام، 2019",
    languagesHeading: "اللغات",
    languagesText: "الإنجليزية (بطلاقة) · الأردية (اللغة الأم)",
  },
  ur: {
    dir: "rtl",
    contact: { phone: "+44 7700 900123", email: "amina.hussain@email.com", location: "برمنگھم، برطانیہ" },
    summaryHeading: "پیشہ ورانہ خلاصہ",
    summary:
      "رہائشی اور ہسپتال کی نگہداشت میں 4 سال سے زائد تجربہ رکھنے والی پُرعزم ہیلتھ کیئر اسسٹنٹ۔ ہمدرد، قابلِ بھروسہ اور اعلیٰ معیار کی مریضوں کی دیکھ بھال فراہم کرنے کے لیے پُرعزم۔ برطانیہ کے ہیلتھ کیئر سیکٹر میں ترقی کے نئے مواقع کی تلاش میں۔",
    experienceHeading: "کام کا تجربہ",
    jobTitle: "ہیلتھ کیئر اسسٹنٹ",
    jobDates: "2020 – تاحال",
    employer: "گرین ووڈ کیئر ہوم، برمنگھم، برطانیہ",
    bullets: [
      "8 سے زائد رہائشیوں کو روزانہ ذاتی نگہداشت فراہم کی، عزت اور آرام کو برقرار رکھا",
      "ادویات کی یاد دہانی اور نقل و حرکت میں مدد کی",
      "نگہداشت کے منصوبوں کو اپ ڈیٹ کرنے کے لیے نرسوں اور خاندانوں کے ساتھ تعاون کیا",
    ],
    skillsHeading: "اہم مہارتیں",
    skills: ["مریضوں کی دیکھ بھال", "ٹیم ورک", "گفتگو", "ابتدائی طبی امداد", "وقت کا انتظام"],
    educationHeading: "تعلیم",
    degree: "صحت اور سماجی نگہداشت میں NVQ لیول 2",
    school: "برمنگھم اڈلٹ ایجوکیشن، 2019",
    languagesHeading: "زبانیں",
    languagesText: "انگریزی (روانی) · اردو (مادری)",
  },
  ro: {
    dir: "ltr",
    contact: { phone: "+44 7700 900123", email: "amina.hussain@email.com", location: "Birmingham, Marea Britanie" },
    summaryHeading: "Profil profesional",
    summary:
      "Asistentă medicală dedicată cu peste 4 ani de experiență în centre rezidențiale și spitale. Empatică, de încredere și dedicată oferirii unui sprijin de înaltă calitate pacienților. Caut o nouă oportunitate de dezvoltare în sectorul medical din Marea Britanie.",
    experienceHeading: "Experiență profesională",
    jobTitle: "Asistentă medicală",
    jobDates: "2020 – prezent",
    employer: "Greenwood Care Home, Birmingham, Marea Britanie",
    bullets: [
      "Am oferit îngrijire personală zilnică pentru peste 8 rezidenți, păstrând demnitatea și confortul",
      "Am asistat la administrarea reamintirilor de medicație și la sprijinul pentru mobilitate",
      "Am colaborat cu asistentele și familiile pentru actualizarea planurilor de îngrijire",
    ],
    skillsHeading: "Abilități cheie",
    skills: ["Îngrijirea pacienților", "Lucru în echipă", "Comunicare", "Prim ajutor", "Gestionarea timpului"],
    educationHeading: "Educație",
    degree: "NVQ Nivel 2 în Sănătate și Îngrijire Socială",
    school: "Birmingham Adult Education, 2019",
    languagesHeading: "Limbi",
    languagesText: "Engleză (fluent) · Urdu (nativ)",
  },
};

const previewLanguages: { code: keyof typeof cvTranslations | string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
  { code: "ar", label: "العربية" },
  { code: "ur", label: "اردو" },
  { code: "ro", label: "Română" },
];

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
  { flag: "🇬🇧", code: "en", name: "English" },
  { flag: "🇵🇱", code: "pl", name: "Polish" },
  { flag: "🇷🇴", code: "ro", name: "Romanian" },
  { flag: "🇮🇳", code: "pa", name: "Punjabi" },
  { flag: "🇵🇰", code: "ur", name: "Urdu" },
  { flag: "🇵🇹", code: "pt", name: "Portuguese" },
  { flag: "🇪🇸", code: "es", name: "Spanish" },
  { flag: "🇸🇦", code: "ar", name: "Arabic" },
  { flag: "🇧🇩", code: "bn", name: "Bengali" },
  { flag: "🇮🇳", code: "gu", name: "Gujarati" },
  { flag: "🇫🇷", code: "fr", name: "French" },
  { flag: "🇹🇷", code: "tr", name: "Turkish" },
  { flag: "🇮🇳", code: "hi", name: "Hindi" },
  { flag: "🇸🇴", code: "so", name: "Somali" },
  { flag: "🇨🇳", code: "zh", name: "Mandarin" },
  { flag: "🇮🇷", code: "fa", name: "Persian" },
  { flag: "🇺🇦", code: "uk", name: "Ukrainian" },
  { flag: "🇽🇰", code: "ku", name: "Kurdish" },
  { flag: "🇱🇰", code: "ta", name: "Tamil" },
  { flag: "🇪🇹", code: "am", name: "Amharic" },
  { flag: "🇪🇷", code: "ti", name: "Tigrinya" },
];

const languages: { flag: string; en: string; native: string; code: string }[] = [
  { flag: "🇬🇧", en: "English", native: "English", code: "en" },
  { flag: "🇵🇱", en: "Polish", native: "Polski", code: "pl" },
  { flag: "🇷🇴", en: "Romanian", native: "Română", code: "ro" },
  { flag: "🇮🇳", en: "Punjabi", native: "ਪੰਜਾਬੀ", code: "pa" },
  { flag: "🇵🇰", en: "Urdu", native: "اردو", code: "ur" },
  { flag: "🇵🇹", en: "Portuguese", native: "Português", code: "pt" },
  { flag: "🇪🇸", en: "Spanish", native: "Español", code: "es" },
  { flag: "🇸🇦", en: "Arabic", native: "عربي", code: "ar" },
  { flag: "🇧🇩", en: "Bengali", native: "বাংলা", code: "bn" },
  { flag: "🇮🇳", en: "Gujarati", native: "ગુજરાતી", code: "gu" },
  { flag: "🇫🇷", en: "French", native: "Français", code: "fr" },
  { flag: "🇹🇷", en: "Turkish", native: "Türkçe", code: "tr" },
  { flag: "🇮🇳", en: "Hindi", native: "हिंदी", code: "hi" },
  { flag: "🇸🇴", en: "Somali", native: "Soomaali", code: "so" },
  { flag: "🇨🇳", en: "Mandarin", native: "普通话", code: "zh" },
  { flag: "🇮🇷", en: "Persian", native: "فارسی", code: "fa" },
  { flag: "🇺🇦", en: "Ukrainian", native: "Українська", code: "uk" },
  { flag: "🇽🇰", en: "Kurdish", native: "Kurdî", code: "ku" },
  { flag: "🇱🇰", en: "Tamil", native: "தமிழ்", code: "ta" },
  { flag: "🇪🇹", en: "Amharic", native: "አማርኛ", code: "am" },
  { flag: "🇪🇷", en: "Tigrinya", native: "ትግርኛ", code: "ti" },
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
  const location = useLocation();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [previewLang, setPreviewLang] = useState<string>("en");
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % chooseLangPhrases.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const hash = location.hash || (typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "");
    if (!hash) return;
    // Wait a tick for DOM to be ready
    const t = setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [location.hash]);
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
                <button
                  type="button"
                  onClick={() => pickLanguage(chooseLangPhrases[phraseIndex].lang)}
                  dir={chooseLangPhrases[phraseIndex].dir}
                  lang={chooseLangPhrases[phraseIndex].lang}
                  key={chooseLangPhrases[phraseIndex].lang}
                  className="inline-flex w-full animate-fade-in items-center justify-center rounded-full border-2 border-primary bg-transparent px-7 py-3 text-base font-semibold text-primary transition-all hover:bg-primary/5 sm:w-auto"
                >
                  {chooseLangPhrases[phraseIndex].text}
                </button>
              </div>

              <div
                className="mt-4 flex animate-fade-in items-center justify-center gap-2 text-sm text-muted-foreground"
                style={{ animationDelay: "450ms" }}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Your information is private and never shared without your permission.</span>
              </div>

              <div
                className="mt-12 animate-fade-in"
                style={{ animationDelay: "500ms" }}
              >
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Available in 20 languages — more coming soon
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

        {/* TRUST STRIP */}
        <section className="border-y border-border bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 text-center sm:grid-cols-2 md:grid-cols-4">
            <div className="flex flex-col items-center gap-1">
              <Globe className="h-5 w-5 text-primary" />
              <p className="font-semibold text-foreground">Build in Your Language</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Check className="h-5 w-5 text-primary" />
              <p className="font-semibold text-foreground">100% Free for Job Seekers</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <FileDown className="h-5 w-5 text-primary" />
              <p className="font-semibold text-foreground">UK-Format CVs</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MessageCircle className="h-5 w-5 text-primary" />
              <p className="font-semibold text-foreground">ATS-Friendly</p>
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

        {/* SAMPLE CV PREVIEW */}
        <section className="bg-secondary/40 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-accent">Preview</span>
              <h2 className="mt-3 font-serif text-4xl text-foreground md:text-5xl">
                See what your CV will look like
              </h2>
              <p className="mt-4 text-muted-foreground">
                Professional UK format, ready to send
              </p>
            </Reveal>

            <Reveal delay={120} className="mx-auto mt-14 max-w-3xl">
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
                {/* Mock CV Document */}
                <div className="bg-white p-8 md:p-12">
                  {/* Header */}
                  <div className="border-b-2 border-primary pb-4">
                    <h3 className="font-serif text-2xl font-bold text-foreground md:text-3xl">Amina Hussain</h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>+44 7700 900123</span>
                      <span>amina.hussain@email.com</span>
                      <span>Birmingham, UK</span>
                    </div>
                  </div>

                  {/* Profile */}
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Professional Summary</h4>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      Dedicated healthcare assistant with 4+ years of experience in residential and hospital care settings. 
                      Compassionate, reliable, and committed to delivering high-quality patient support. 
                      Seeking a new opportunity to grow within the UK healthcare sector.
                    </p>
                  </div>

                  {/* Experience */}
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Work Experience</h4>
                    <div className="mt-3">
                      <div className="flex justify-between items-baseline">
                        <p className="text-sm font-semibold text-foreground">Healthcare Assistant</p>
                        <p className="text-xs text-muted-foreground">2020 – Present</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Greenwood Care Home, Birmingham, UK</p>
                      <ul className="mt-2 space-y-1 text-sm text-foreground">
                        <li>• Provided daily personal care to 8+ residents, maintaining dignity and comfort</li>
                        <li>• Assisted with medication reminders and mobility support</li>
                        <li>• Collaborated with nurses and families to update care plans</li>
                      </ul>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Key Skills</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {["Patient Care", "Teamwork", "Communication", "First Aid", "Time Management"].map((skill) => (
                        <span key={skill} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Education */}
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Education</h4>
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-foreground">NVQ Level 2 in Health and Social Care</p>
                      <p className="text-xs text-muted-foreground">Birmingham Adult Education, 2019</p>
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="mt-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Languages</h4>
                    <p className="mt-2 text-sm text-foreground">English (Fluent) · Urdu (Native)</p>
                  </div>
                </div>

                {/* Watermark footer */}
                <div className="border-t border-border bg-secondary/50 px-8 py-3 text-center text-xs text-muted-foreground">
                  Created with CVLingo · cvlingo.com
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ATS BANNER */}
        <section className="bg-primary py-10">
          <div className="mx-auto max-w-4xl px-5 text-center">
            <p className="text-lg font-medium text-primary-foreground md:text-xl">
              Every CV is ATS-friendly and formatted for UK employers
            </p>
            <p className="mt-2 text-sm text-primary-foreground/80">
              Our templates use clean layouts and standard headings that pass Applicant Tracking Systems and impress hiring managers.
            </p>
          </div>
        </section>

        {/* STATS */}
        <section className="bg-background py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 text-center md:grid-cols-3">
            <div>
              <div className="font-serif text-5xl text-foreground md:text-6xl">
                <CountUp value={20} />
              </div>
              <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">Languages Supported</p>
            </div>
            <div>
              <div className="font-serif text-5xl text-foreground md:text-6xl">
                <CountUp value={100} suffix="%" />
              </div>
              <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">Free for Jobseekers</p>
            </div>
            <div>
              <div className="font-serif text-5xl text-foreground md:text-6xl">UK Format</div>
              <p className="mt-2 text-sm uppercase tracking-widest text-muted-foreground">Job Market Ready</p>
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
