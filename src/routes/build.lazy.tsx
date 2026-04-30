import { createLazyFileRoute } from "@tanstack/react-router";
import { BuildPage } from "@/components/build/BuildPage";

export const Route = createLazyFileRoute("/build")({
  component: BuildPage,
});