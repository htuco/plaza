"use client";

import { useFormStatus } from "react-dom";

// The screen's primary action: 56px, full width, one per screen.
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="plaza-button rm-cta disabled:opacity-60"
    >
      {pending ? "…" : children}
    </button>
  );
}
