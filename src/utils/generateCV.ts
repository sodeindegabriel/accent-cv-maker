import { generateCVServer } from "@/lib/cv.functions";
import type { CVData, GeneratedCV } from "@/lib/cv.functions";

export type { CVData, GeneratedCV };

export async function generateCV(cvData: CVData): Promise<GeneratedCV> {
  return generateCVServer({ data: cvData });
}
