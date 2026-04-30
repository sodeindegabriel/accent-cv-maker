import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CVProvider } from "../context/CVContext.tsx";
import { Step1Language } from "../components/build/Step1Language.tsx";
import { Step2JobType } from "../components/build/Step2JobType.tsx";
import { Step3PersonalDetails } from "../components/build/Step3PersonalDetails.tsx";
import { Step4Experience } from "../components/build/Step4Experience.tsx";
import { Step5Skills } from "../components/build/Step5Skills.tsx";
import { Step6Review } from "../components/build/Step6Review.tsx";

export const Route = createLazyFileRoute("/build")({
  component: BuildPage,
});

function BuildPage() {
  const [step, setStep] = useState(1);
  const next = () => setStep((s) => Math.min(6, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <CVProvider>
      {step === 1 && <Step1Language onNext={next} />}
      {step === 2 && <Step2JobType onNext={next} onBack={back} />}
      {step === 3 && <Step3PersonalDetails onNext={next} onBack={back} />}
      {step === 4 && <Step4Experience onNext={next} onBack={back} />}
      {step === 5 && <Step5Skills onNext={next} onBack={back} />}
      {step === 6 && (
        <Step6Review
          onBack={back}
          onEdit={(s) => setStep(s)}
          onGenerate={() => {
            alert("Your CV is being generated!");
          }}
        />
      )}
    </CVProvider>
  );
}