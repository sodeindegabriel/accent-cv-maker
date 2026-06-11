import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

function RefRedirect() {
  const navigate = useNavigate();
  const { code } = Route.useParams();

  useEffect(() => {
    try {
      if (code) {
        const clean = String(code).trim().toLowerCase().slice(0, 64);
        if (clean) localStorage.setItem("cvlingo_referral", clean);
      }
    } catch {
      /* ignore */
    }
    navigate({ to: "/", replace: true });
  }, [code, navigate]);

  return null;
}

export const Route = createFileRoute("/ref/$code")({
  component: RefRedirect,
  head: () => ({
    meta: [
      { title: "CVLingo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
