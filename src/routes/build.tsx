import { createFileRoute } from "@tanstack/react-router";
import { BuildPage } from "../components/build/BuildPage.tsx";

export const Route = createFileRoute("/build")({
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
