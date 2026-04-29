import { createContext, useContext, useState, type ReactNode } from "react";

export type Experience = {
  title: string;
  place: string;
  duration: string;
  description: string;
};

export type PersonalDetails = {
  name: string;
  phone: string;
  email: string;
  city: string;
  rightToWork: string;
};

export type CVData = {
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

type CVContextValue = {
  data: CVData;
  update: <K extends keyof CVData>(key: K, value: CVData[K]) => void;
  reset: () => void;
};

const CVContext = createContext<CVContextValue | null>(null);

export function CVProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CVData>(initialData);
  const update = <K extends keyof CVData>(key: K, value: CVData[K]) =>
    setData((d) => ({ ...d, [key]: value }));
  const reset = () => setData(initialData);
  return <CVContext.Provider value={{ data, update, reset }}>{children}</CVContext.Provider>;
}

export function useCV() {
  const ctx = useContext(CVContext);
  if (!ctx) throw new Error("useCV must be used within CVProvider");
  return ctx;
}
