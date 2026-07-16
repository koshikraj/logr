"use client";

// Submit button for the seeded-profile claim form: the claim action takes a
// few seconds (verify → flip ownership → revalidate → dashboard), so show a
// pending state immediately and block double-submits.

import { useFormStatus } from "react-dom";

export function ClaimButton({ username }: { username: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn--primary"
      disabled={pending}
      style={{ width: "100%", justifyContent: "center", opacity: pending ? 0.6 : 1 }}
    >
      {pending ? "claiming your profile…" : `claim @${username} →`}
    </button>
  );
}
