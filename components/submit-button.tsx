"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: ReactNode;
};

export function SubmitButton({ children }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className="primary-button" disabled={pending} type="submit">
      {pending ? "Ingresando..." : children}
    </button>
  );
}
