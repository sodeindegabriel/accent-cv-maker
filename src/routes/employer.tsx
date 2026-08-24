import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/employer")({
  beforeLoad: () => {
    throw redirect({ to: "/employers", replace: true });
  },
});
