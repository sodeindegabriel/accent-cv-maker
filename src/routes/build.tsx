import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { generateCV } from "@/utils/generateCV";
import { GeneratingOverlay } from "@/components/GeneratingOverlay";

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

  const update = <K extends keyof CVData>(key: K, value: CVData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const next = () => setStep((current) => Math.min(6, current + 1));
  const back = () => setStep((current) => Math.max(1, current - 1));

  return (
    <main className="min-h-screen bg-background text-foreground">
      {step === 1 && <Step1Language data={data} update={update} onNext={next} />}
      {step === 2 && <Step2JobType data={data} update={update} onBack={back} onNext={next} />}
      {step === 3 && <Step3PersonalDetails data={data} update={update} onBack={back} onNext={next} />}
      {step === 4 && <Step4Experience data={data} update={update} onBack={back} onNext={next} />}
      {step === 5 && <Step5Skills data={data} update={update} onBack={back} onNext={next} />}
      {step === 6 && <Step6Review data={data} onBack={back} onEdit={setStep} />}
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
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  nextDisabled?: boolean;
  onBack?: () => void;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
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
              Back
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
            Continue
          </button>
        </div>
      </div>
    </section>
  );
}

function Step1Language({ data, update, onNext }: StepProps) {
  return (
    <StepShell
      step={1}
      title="What language would you like to use?"
      subtitle="Answer in the language that feels easiest for you."
      onNext={onNext}
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
                setTimeout(() => onNext(), 500);
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
      </div>
    </StepShell>
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
      title="What kind of work are you looking for?"
      subtitle="Choose every type of role you would consider."
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
      title="Tell us about yourself"
      subtitle="These details help employers contact you."
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
      title="What experience do you have?"
      subtitle="Paid, informal and volunteer experience can all help your CV."
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
      title="What are your skills and availability?"
      subtitle="Select the strengths and working times that fit you."
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

function Step6Review({ data, onBack, onEdit }: { data: CVData; onBack: () => void; onEdit: (step: number) => void }) {
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
          <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">Review your CV details</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">Check everything before generating your English CV.</p>
        </div>
        <div className="space-y-4">
          <ReviewSection title="Language" onEdit={() => onEdit(1)}>{data.language || "Not selected"}</ReviewSection>
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
