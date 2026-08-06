"use client";

import { useEffect, useState } from "react";
import { listConnectedAgentsAction, revokeAgentAction } from "@/lib/actions";
import type { GrantView } from "@/lib/oauth";

// Dashboard "agents" tab: OAuth grants issued from the /oauth/authorize
// consent screen (issue #58). Revoking kills the grant's tokens immediately.

function when(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function ConnectedAgents() {
  const [grants, setGrants] = useState<GrantView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listConnectedAgentsAction().then(setGrants).catch(() => setGrants([]));
  }, []);

  async function revoke(id: string) {
    setBusy(id);
    try {
      setGrants(await revokeAgentAction(id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <span className="card__head__title">connected agents</span>
      </div>
      <p className="field__hint">
        AI agents you authorized (via MCP + OAuth) to write to your log. They can always read
        your public page — these grants add scoped write access. Revoking takes effect
        immediately.
      </p>
      {grants === null ? (
        <p className="field__hint">loading…</p>
      ) : grants.length === 0 ? (
        <p className="field__hint">
          no agents connected. point one at the MCP server (<code>/mcp</code>) and it can
          request access here.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {grants.map((g) => (
            <li key={g.id} className="field-row" style={{ alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="field__label">{g.clientName}</div>
                <div className="field__hint">
                  {g.scope.split(" ").join(" · ")} — connected {when(g.createdAt)}, last used{" "}
                  {when(g.lastUsedAt)}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => revoke(g.id)}
                disabled={busy === g.id}
              >
                {busy === g.id ? "revoking…" : "revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
