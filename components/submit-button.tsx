"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="plaza-button h-11 rounded-lg text-sm font-medium disabled:opacity-60"
    >
      {pending ? "..." : children}
    </button>
  );
}
