"use client";

import { useState } from "react";
import { startSignupAction } from "@/lib/actions";

/** Landing handle-claim field: type a handle, "claim" starts Google sign-in
 *  and carries the handle into onboarding (/welcome?handle=…). */
export function HandleClaim({ id, autoFocus }: { id: string; autoFocus?: boolean }) {
  const [value, setValue] = useState("");

  return (
    <form action={startSignupAction} style={{ display: "contents" }}>
      <label className="handle-input" htmlFor={id}>
        <span className="handle-input__prefix">logr.it<span className="accent">/</span></span>
        <input
          id={id}
          name="handle"
          type="text"
          placeholder="yourname"
          spellCheck={false}
          autoComplete="off"
          maxLength={24}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        />
      </label>
      <button type="submit" className="hero__claim">claim →</button>
    </form>
  );
}
