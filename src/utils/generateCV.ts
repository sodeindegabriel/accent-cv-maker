import { generateCVServer } from "@/server/cv.functions";
import type { CVData, GeneratedCV } from "@/server/cv.functions";

export type { CVData, GeneratedCV };

export async function generateCV(cvData: CVData): Promise<GeneratedCV> {
  return generateCVServer({ data: cvData });
}
