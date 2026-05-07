import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { generateCV } from "@/utils/generateCV";
import { GeneratingOverlay } from "@/components/GeneratingOverlay";
import { BridgeIcon } from "@/components/BridgeIcon";
import { Clock } from "lucide-react";
import { t, type TKey } from "@/lib/buildTranslations";

type Experience = {
  title: string;
  place: string;
  duration: string;
  description: string;
};

type PersonalDetails = {
  name: string;
  phone: string;
  email: string;
  city: string;
  rightToWork: string;
};

type CVData = {
  language: string;
  languageCode: string;
  /** Language code used to display the questions in the build form. */
  questionLanguageCode: string;
  jobTypes: string[];
  otherJobType: string;
  personalDetails: PersonalDetails;
  experienceType: string;
  experience: Experience[];
  skills: string[];
  availability: string[];
};

const initialData: CVData = {
  language: "",
  languageCode: "",
  questionLanguageCode: "en",
  jobTypes: [],
  otherJobType: "",
  personalDetails: { name: "", phone: "", email: "", city: "", rightToWork: "" },
  experienceType: "",
  experience: [],
  skills: [],
  availability: [],
};

const languages = [
  { code: "en", name: "English", native: "English", flag: "🇬🇧" },
  { code: "ar", name: "Arabic", native: "عربي", flag: "🇸🇦" },
  { code: "uk", name: "Ukrainian", native: "Українська", flag: "🇺🇦" },
  { code: "pl", name: "Polish", native: "Polski", flag: "🇵🇱" },
  { code: "ro", name: "Romanian", native: "Română", flag: "🇷🇴" },
  { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "pt", name: "Portuguese", native: "Português", flag: "🇵🇹" },
  { code: "fr", name: "French", native: "Français", flag: "🇫🇷" },
  { code: "ur", name: "Urdu", native: "اردو", flag: "🇵🇰" },
  { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", native: "বাংলা", flag: "🇧🇩" },
  { code: "so", name: "Somali", native: "Soomaali", flag: "🇸🇴" },
  { code: "sw", name: "Swahili", native: "Kiswahili", flag: "🇰🇪" },
  { code: "tr", name: "Turkish", native: "Türkçe", flag: "🇹🇷" },
  { code: "fa", name: "Farsi", native: "فارسی", flag: "🇮🇷" },
  { code: "zh", name: "Chinese", native: "中文", flag: "🇨🇳" },
  { code: "yo", name: "Yoruba", native: "Yorùbá", flag: "🇳🇬" },
  { code: "ig", name: "Igbo", native: "Igbo", flag: "🇳🇬" },
  { code: "om", name: "Oromo", native: "Afaan Oromoo", flag: "🇪🇹" },
  { code: "ln", name: "Lingala", native: "Lingála", flag: "🇨🇩" },
];

const jobs = [
  { id: "hospitality", label: "Hospitality", emoji: "🍽️" },
  { id: "construction", label: "Construction", emoji: "🏗️" },
  { id: "care", label: "Care work", emoji: "🤝" },
  { id: "delivery", label: "Delivery & driving", emoji: "🚗" },
  { id: "cleaning", label: "Cleaning", emoji: "🧹" },
  { id: "retail", label: "Retail", emoji: "🛍️" },
  { id: "warehouse", label: "Warehouse", emoji: "📦" },
  { id: "office", label: "Office work", emoji: "💼" },
  { id: "beauty", label: "Beauty & salon", emoji: "💇" },
  { id: "other", label: "Something else", emoji: "✨" },
];

const rightToWorkOptions = [
  "British citizen",
  "Settled / pre-settled status",
  "Skilled worker visa",
  "Student visa",
  "Refugee status",
  "Other / not sure",
];

const experienceTypes = [
  { id: "paid", label: "Paid work", desc: "Jobs in the UK or back home" },
  { id: "informal", label: "Informal / family work", desc: "Helped family business or neighbours" },
  { id: "volunteer", label: "Volunteering", desc: "Unpaid work for community or charity" },
  { id: "none", label: "No experience yet", desc: "I’m just starting out" },
];

const suggestedSkills = [
  "Customer service",
  "Teamwork",
  "Timekeeping",
  "Cleaning",
  "Food preparation",
  "Stock handling",
  "Driving",
  "Cash handling",
  "Care support",
  "Microsoft Office",
  "Problem solving",
  "English communication",
];

const availabilityOptions = ["Weekdays", "Weekends", "Evenings", "Early mornings", "Full-time", "Part-time"];

function BuildPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<CVData>(initialData);

  useEffect(() => {
    try {
      const inputRaw = sessionStorage.getItem("cvlingo:input");
      if (inputRaw) setData(JSON.parse(inputRaw));
    } catch {
      /* ignore */
    }
    try {
      const preselect = sessionStorage.getItem("cvlingo:preselectLanguage");
      if (preselect) {
        const lang = languages.find((l) => l.code === preselect);
        if (lang) {
          setData((current) => ({ ...current, languageCode: lang.code, language: lang.name }));
          setStep(2);
        }
        sessionStorage.removeItem("cvlingo:preselectLanguage");
      }
      const editStep = sessionStorage.getItem("cvlingo:editStep");
      if (editStep) {
        const n = parseInt(editStep, 10);
        if (n >= 1 && n <= 6) setStep(n);
        sessionStorage.removeItem("cvlingo:editStep");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = <K extends keyof CVData>(key: K, value: CVData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const next = () => setStep((current) => Math.min(6, current + 1));
  const back = () => setStep((current) => Math.max(1, current - 1));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-primary transition hover:opacity-80"
            aria-label="CVLingo — back to home"
          >
            <BridgeIcon className="h-7 w-7" />
            <span className="font-serif text-2xl">CVLingo</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>
      {step === 1 && <Step1Language data={data} update={update} onNext={next} />}
      {step === 2 && <Step2JobType data={data} update={update} onBack={back} onNext={next} />}
      {step === 3 && <Step3PersonalDetails data={data} update={update} onBack={back} onNext={next} />}
      {step === 4 && <Step4Experience data={data} update={update} onBack={back} onNext={next} />}
      {step === 5 && <Step5Skills data={data} update={update} onBack={back} onNext={next} />}
      {step === 6 && <Step6Review data={data} update={update} onBack={back} onEdit={setStep} />}
    </main>
  );
}

type StepProps = {
  data: CVData;
  update: <K extends keyof CVData>(key: K, value: CVData[K]) => void;
  onBack?: () => void;
  onNext: () => void;
};

function StepShell({
  step,
  title,
  subtitle,
  nextDisabled,
  onBack,
  onNext,
  qLang,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  onNext: () => void;
  qLang?: string;
  children: React.ReactNode;
}) {
  const dir = qLang && ["ar", "ur", "fa"].includes(qLang) ? "rtl" : "ltr";
  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8" dir={dir}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2" aria-label={`Step ${step} of 6`}>
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full ${index + 1 <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Step {step} of 6</p>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">{children}</div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-border bg-background px-5 py-3 font-medium text-foreground transition hover:bg-muted"
            >
              {t(qLang, "back")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(qLang, "continue")}
          </button>
        </div>
      </div>
    </section>
  );
}

function Step1Language({ data, update, onNext }: StepProps) {
  const [showModal, setShowModal] = useState(false);
  const selectedLang = languages.find((l) => l.code === data.languageCode);

  const handleContinue = () => {
    if (!selectedLang) return;
    if (selectedLang.code === "en") {
      update("questionLanguageCode", "en");
      onNext();
    } else {
      setShowModal(true);
    }
  };

  const choose = (code: string) => {
    update("questionLanguageCode", code);
    setShowModal(false);
    onNext();
  };

  return (
    <>
      <StepShell
        step={1}
        title="What language would you like to use?"
        subtitle="Answer in the language that feels easiest for you."
        onNext={handleContinue}
        nextDisabled={!data.languageCode}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {languages.map((language) => {
            const selected = data.languageCode === language.code;
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => {
                  update("languageCode", language.code);
                  update("language", language.name);
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  selected ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span className="block text-2xl" aria-hidden="true">{language.flag}</span>
                <span className="mt-2 block font-medium text-foreground">{language.name}</span>
                <span className="block text-sm text-muted-foreground">{language.native}</span>
              </button>
            );
          })}
          <ComingSoonCard />
        </div>
      </StepShell>
      {showModal && selectedLang && (
        <LanguageChoiceModal
          lang={selectedLang}
          onChoose={choose}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function ComingSoonCard() {
  return (
    <div
      aria-disabled="true"
      className="flex flex-col items-start justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-4 text-left opacity-70"
    >
      <Clock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <span className="mt-2 block font-medium text-muted-foreground">More languages</span>
      <span className="block text-sm text-muted-foreground">coming soon…</span>
    </div>
  );
}

function LanguageChoiceModal({
  lang,
  onChoose,
  onClose,
}: {
  lang: { code: string; name: string; native: string };
  onChoose: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">
          {t(lang.code, "modalQuestion").replace("{lang}", lang.native)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your CV will always be generated in both {lang.name} and English.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onChoose(lang.code)}
            className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {lang.native}
          </button>
          <button
            type="button"
            onClick={() => onChoose("en")}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition hover:bg-muted"
          >
            English
          </button>
        </div>
      </div>
    </div>
  );
}

function Step2JobType({ data, update, onBack, onNext }: StepProps) {
  const toggle = (id: string) => {
    const selected = new Set(data.jobTypes);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    update("jobTypes", Array.from(selected));
  };

  return (
    <StepShell
      step={2}
      qLang={data.questionLanguageCode}
      title={t(data.questionLanguageCode, "step2Title")}
      subtitle={t(data.questionLanguageCode, "step2Subtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={data.jobTypes.length === 0}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {jobs.map((job) => {
          const selected = data.jobTypes.includes(job.id);
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => toggle(job.id)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                selected ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{job.emoji}</span>
              <span className="font-medium text-foreground">{job.label}</span>
            </button>
          );
        })}
      </div>

      {data.jobTypes.includes("other") && (
        <TextField
          className="mt-4"
          label="Other work type"
          value={data.otherJobType}
          onChange={(value) => update("otherJobType", value)}
          placeholder="Tell us what kind of work"
        />
      )}
    </StepShell>
  );
}

function Step3PersonalDetails({ data, update, onBack, onNext }: StepProps) {
  const personal = data.personalDetails;
  const setPersonal = (key: keyof PersonalDetails, value: string) => {
    update("personalDetails", { ...personal, [key]: value });
  };
  const isOther = personal.rightToWork.startsWith("Other:") || personal.rightToWork === "Other / not sure";
  const otherDetail = personal.rightToWork.startsWith("Other:") ? personal.rightToWork.slice(6).trim() : "";
  const valid = Boolean(
    personal.name &&
      personal.phone &&
      personal.city &&
      personal.rightToWork &&
      (!isOther || otherDetail.length > 0),
  );

  return (
    <StepShell
      step={3}
      qLang={data.questionLanguageCode}
      title={t(data.questionLanguageCode, "step3Title")}
      subtitle={t(data.questionLanguageCode, "step3Subtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!valid}
    >
      <div className="space-y-4">
        <TextField label="Full name" value={personal.name} onChange={(value) => setPersonal("name", value)} placeholder="Maria Kowalska" />
        <TextField label="Phone number" value={personal.phone} onChange={(value) => setPersonal("phone", value)} placeholder="07…" type="tel" />
        <TextField label="Email" value={personal.email} onChange={(value) => setPersonal("email", value)} placeholder="you@example.com" type="email" />
        <TextField label="City in the UK" value={personal.city} onChange={(value) => setPersonal("city", value)} placeholder="London" />
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Right to work</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {rightToWorkOptions.map((option) => {
              const selected =
                option === "Other / not sure" ? isOther : personal.rightToWork === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    setPersonal(
                      "rightToWork",
                      option === "Other / not sure" ? "Other:" : option,
                    )
                  }
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {isOther && (
            <div className="mt-3">
              <TextField
                label="Please describe your status"
                value={otherDetail}
                onChange={(value) => setPersonal("rightToWork", `Other: ${value}`)}
                placeholder="e.g. Pre-settled status, applying for visa…"
              />
            </div>
          )}
        </div>
      </div>
    </StepShell>
  );
}

function Step4Experience({ data, update, onBack, onNext }: StepProps) {
  const addExperience = () => {
    update("experience", [...data.experience, { title: "", place: "", duration: "", description: "" }]);
  };
  const updateExperience = (index: number, key: keyof Experience, value: string) => {
    update(
      "experience",
      data.experience.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  };
  const removeExperience = (index: number) => {
    update("experience", data.experience.filter((_, itemIndex) => itemIndex !== index));
  };
  const valid = Boolean(data.experienceType && (data.experienceType === "none" || data.experience.length > 0));

  return (
    <StepShell
      step={4}
      qLang={data.questionLanguageCode}
      title={t(data.questionLanguageCode, "step4Title")}
      subtitle={t(data.questionLanguageCode, "step4Subtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!valid}
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {experienceTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                update("experienceType", type.id);
                if (type.id === "none") update("experience", []);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                data.experienceType === type.id
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span className="block font-medium text-foreground">{type.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{type.desc}</span>
            </button>
          ))}
        </div>

        {data.experienceType && data.experienceType !== "none" && (
          <div className="space-y-4">
            {data.experience.map((experience, index) => (
              <div key={index} className="rounded-xl border border-border bg-background p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-medium text-foreground">Experience {index + 1}</h2>
                  <button type="button" onClick={() => removeExperience(index)} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                    Remove
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Role or activity" value={experience.title} onChange={(value) => updateExperience(index, "title", value)} placeholder="Kitchen assistant" />
                  <TextField label="Company or place" value={experience.place} onChange={(value) => updateExperience(index, "place", value)} placeholder="Cafe Roma" />
                  <TextField label="Dates" value={experience.duration} onChange={(value) => updateExperience(index, "duration", value)} placeholder="2022–2024" />
                  <TextField label="What you did" value={experience.description} onChange={(value) => updateExperience(index, "description", value)} placeholder="Prepared food and served customers" />
                </div>
              </div>
            ))}
            <button type="button" onClick={addExperience} className="rounded-xl border border-border bg-background px-4 py-3 font-medium text-foreground transition hover:bg-muted">
              Add experience
            </button>
          </div>
        )}
      </div>
    </StepShell>
  );
}

function Step5Skills({ data, update, onBack, onNext }: StepProps) {
  const [customSkill, setCustomSkill] = useState("");
  const toggleValue = (key: "skills" | "availability", value: string) => {
    const selected = new Set(data[key]);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    update(key, Array.from(selected));
  };
  const addCustomSkill = () => {
    const skill = customSkill.trim();
    if (!skill || data.skills.includes(skill)) return;
    update("skills", [...data.skills, skill]);
    setCustomSkill("");
  };

  return (
    <StepShell
      step={5}
      qLang={data.questionLanguageCode}
      title={t(data.questionLanguageCode, "step5Title")}
      subtitle={t(data.questionLanguageCode, "step5Subtitle")}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={data.skills.length === 0 || data.availability.length === 0}
    >
      <div className="space-y-6">
        <div>
          <h2 className="mb-3 font-medium text-foreground">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {suggestedSkills.map((skill) => (
              <Chip key={skill} selected={data.skills.includes(skill)} onClick={() => toggleValue("skills", skill)}>
                {skill}
              </Chip>
            ))}
            {data.skills
              .filter((skill) => !suggestedSkills.includes(skill))
              .map((skill) => (
                <Chip key={skill} selected onClick={() => toggleValue("skills", skill)}>
                  {skill}
                </Chip>
              ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={customSkill}
              onChange={(event) => setCustomSkill(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomSkill();
                }
              }}
              placeholder="Add another skill"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button type="button" onClick={addCustomSkill} className="rounded-xl bg-secondary px-4 py-3 font-medium text-secondary-foreground transition hover:opacity-90">
              Add
            </button>
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-medium text-foreground">Availability</h2>
          <div className="flex flex-wrap gap-2">
            {availabilityOptions.map((option) => (
              <Chip key={option} selected={data.availability.includes(option)} onClick={() => toggleValue("availability", option)}>
                {option}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  );
}

function Step6Review({ data, update, onBack, onEdit }: { data: CVData; update: <K extends keyof CVData>(key: K, value: CVData[K]) => void; onBack: () => void; onEdit: (step: number) => void }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateCV(data);
      sessionStorage.setItem("cvlingo:result", JSON.stringify(result));
      sessionStorage.setItem("cvlingo:input", JSON.stringify(data));
      navigate({ to: "/result" });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setGenerating(false);
    }
  };

  const jobLabels = useMemo(
    () =>
      data.jobTypes
        .map((id) => (id === "other" ? data.otherJobType || "Other" : jobs.find((job) => job.id === id)?.label))
        .filter(Boolean)
        .join(", "),
    [data.jobTypes, data.otherJobType],
  );

  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Step 6 of 6</p>
          <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">{t(data.questionLanguageCode, "step6Title")}</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">{t(data.questionLanguageCode, "step6Subtitle")}</p>
        </div>
        <div className="space-y-4">
          <LanguageReviewSection
            currentName={data.language}
            onSelect={(lang) => {
              update("languageCode", lang.code);
              update("language", lang.name);
            }}
          />
          <ReviewSection title="Work wanted" onEdit={() => onEdit(2)}>{jobLabels || "Not selected"}</ReviewSection>
          <ReviewSection title="Personal details" onEdit={() => onEdit(3)}>
            <p>{data.personalDetails.name || "Name missing"}</p>
            <p>{data.personalDetails.phone || "Phone missing"}</p>
            <p>{data.personalDetails.email || "Email not provided"}</p>
            <p>{data.personalDetails.city || "City missing"}</p>
            <p>{data.personalDetails.rightToWork || "Right to work missing"}</p>
          </ReviewSection>
          <ReviewSection title="Experience" onEdit={() => onEdit(4)}>
            {data.experienceType === "none" ? (
              <p>No experience yet</p>
            ) : data.experience.length ? (
              <ul className="space-y-2">
                {data.experience.map((item, index) => (
                  <li key={index}>
                    <span className="font-medium text-foreground">{item.title || "Role"}</span>
                    {item.place && ` — ${item.place}`}
                    {item.duration && ` (${item.duration})`}
                    {item.description && <span className="block text-sm text-muted-foreground">{item.description}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Not added</p>
            )}
          </ReviewSection>
          <ReviewSection title="Skills and availability" onEdit={() => onEdit(5)}>
            <p>{data.skills.join(", ") || "No skills selected"}</p>
            <p>{data.availability.join(", ") || "No availability selected"}</p>
          </ReviewSection>
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Something went wrong. Please try again.</p>
            <p className="mt-1 opacity-80">{error}</p>
            <button type="button" onClick={handleGenerate} className="mt-3 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90">
              Retry
            </button>
          </div>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="rounded-xl border border-border bg-background px-5 py-3 font-medium text-foreground transition hover:bg-muted">
            Back
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate My CV"}
          </button>
        </div>
      </div>
      {generating && <GeneratingOverlay />}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-primary hover:opacity-80">
          Edit
        </button>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

type LangOption = (typeof languages)[number];

function LanguageReviewSection({ currentName, onSelect }: { currentName: string; onSelect: (lang: LangOption) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">Language</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-sm font-medium text-primary hover:opacity-80"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>
      <div className="text-sm leading-6 text-muted-foreground">{currentName || "Not selected"}</div>
      {open && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {languages.map((lang) => {
            const selected = lang.name === currentName;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onSelect(lang);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                  selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span className="text-xl" aria-hidden="true">{lang.flag}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{lang.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{lang.native}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export const Route = createFileRoute("/build")({
  codeSplitGroupings: [],
  head: () => ({
    meta: [
      { title: "Build Your CV — CVLingo" },
      { name: "description", content: "Build your professional UK CV in your own language, one simple question at a time." },
      { property: "og:title", content: "Build Your CV — CVLingo" },
      { property: "og:description", content: "Build your professional UK CV in your own language, one simple question at a time." },
    ],
  }),
  component: BuildPage,
});
