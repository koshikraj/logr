"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useSheetDrag } from "@/components/ui/useSheetDrag";

export function ShareModal({
  username,
  name,
  open,
  onClose,
  withAsk,
}: {
  username: string;
  name: string;
  open: boolean;
  onClose: () => void;
  /** also offer the /ask chat link (used on the dedicated ask page) */
  withAsk?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"agents" | "llmtxt" | "people">("agents");
  const [client, setClient] = useState("claude-code");
  const cardRef = useRef<HTMLDivElement>(null);
  useSheetDrag(cardRef, onClose, open); // phones: swipe the sheet down to dismiss

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = `${origin}/${username}`;
  const agentUrl = `${pageUrl}/llm.txt`;
  const mcpUrl = `${origin}/mcp`;
  const examplePrompt = `Read ${agentUrl} and tell me about ${name} — their background, what they're building now, and anything notable.`;
  const askPrompt = `Using the logr tools, tell me about @${username} — what are they building right now?`;

  // One connection covers every logr profile; the prompt carries the handle.
  const CLIENTS: {
    key: string;
    label: string;
    snippet: string;
    note: ReactNode;
  }[] = [
    {
      key: "claude-code",
      label: "claude code",
      snippet: `claude mcp add --transport http logr ${mcpUrl}`,
      note: <>one command connects the log. writes for the owner: <span className="accent">/mcp</span> → authenticate.</>,
    },
    {
      key: "claude-ai",
      label: "claude.ai",
      snippet: mcpUrl,
      note: <>settings <span className="accent">→</span> connectors <span className="accent">→</span> add custom connector, paste the URL.</>,
    },
    {
      key: "codex",
      label: "codex",
      snippet: `codex mcp add logr --url ${mcpUrl}`,
      note: <>owner writes: <span className="accent">codex mcp login logr</span> runs the OAuth flow.</>,
    },
    {
      key: "vscode",
      label: "vs code",
      snippet: `code --add-mcp '{"name":"logr","type":"http","url":"${mcpUrl}"}'`,
      note: <>adds the server to Copilot&apos;s MCP config.</>,
    },
    {
      key: "hermes",
      label: "hermes",
      snippet: `hermes mcp add logr --url ${mcpUrl}`,
      note: <>owner writes: <span className="accent">hermes mcp login logr</span> after adding with <span className="accent">--auth oauth</span>.</>,
    },
    {
      key: "other",
      label: "any",
      snippet: mcpUrl,
      note: <>a streamable HTTP <span className="accent">MCP</span> endpoint — point any client at it.</>,
    },
  ];
  const active = CLIENTS.find((c) => c.key === client) ?? CLIENTS[0];

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  const label = (key: string, base = "copy") => (copied === key ? "copied ✓" : base);

  return (
    <div className="share__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="share" ref={cardRef} role="dialog" aria-modal="true" aria-label={`share ${name}'s log`}>
        <div className="share__head">
          <span>share <span className="accent">/</span> {name.toLowerCase()}</span>
          <button onClick={onClose} aria-label="close">×</button>
        </div>

        <nav className="share__tabs" role="tablist" aria-label="share audience">
          <button type="button" role="tab" className="share__tab" aria-current={tab === "agents"} onClick={() => setTab("agents")}>
            for agents <span className="accent">·</span> mcp
          </button>
          <button type="button" role="tab" className="share__tab" aria-current={tab === "llmtxt"} onClick={() => setTab("llmtxt")}>
            llm.txt
          </button>
          <button type="button" role="tab" className="share__tab" aria-current={tab === "people"} onClick={() => setTab("people")}>
            for people
          </button>
        </nav>

        <div className="share__body">
          {tab === "agents" && (
            <>
              <div className="share__block">
                <span className="share__label">connect <span className="accent">·</span> mcp</span>
                <div className="share__clients" role="tablist" aria-label="agent client">
                  {CLIENTS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="tab"
                      className="share__client"
                      aria-current={client === c.key}
                      onClick={() => setClient(c.key)}
                      title={c.label}
                    >
                      {/* colored brand marks live in public/agents/<key>.svg —
                          swap the files to change icons, no code involved */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/agents/${c.key}.svg`} alt="" />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
                <div className="share__prompt share__prompt--fixed">
                  <code>{active.snippet}</code>
                  <button type="button" onClick={() => copy(active.snippet, `mcp-${active.key}`)}>{label(`mcp-${active.key}`)}</button>
                </div>
                <p className="share__note share__note--fixed">{active.note}</p>
                <div className="share__prompt">
                  <code>{askPrompt}</code>
                  <button type="button" onClick={() => copy(askPrompt, "ask-prompt")}>{label("ask-prompt", "copy prompt")}</button>
                </div>
                <p className="share__note">one connection reads every logr — the handle rides in the prompt.</p>
              </div>
            </>
          )}

          {tab === "llmtxt" && (
            <div className="share__block">
              <span className="share__label">no mcp? <span className="accent">·</span> llm.txt</span>
              <div className="share__row">
                <input readOnly value={agentUrl} onFocus={(e) => e.currentTarget.select()} aria-label="agent link" />
                <button type="button" onClick={() => copy(agentUrl, "agent")}>{label("agent")}</button>
              </div>
              <p className="share__note">a structured <span className="accent">llm.txt</span> any AI can ingest. paste this into ChatGPT or Claude:</p>
              <div className="share__prompt">
                <code>{examplePrompt}</code>
                <button type="button" onClick={() => copy(examplePrompt, "prompt")}>{label("prompt", "copy prompt")}</button>
              </div>
            </div>
          )}

          {tab === "people" && (
            <>
              <div className="share__block">
                <span className="share__label">the page</span>
                <div className="share__row">
                  <input readOnly value={pageUrl} onFocus={(e) => e.currentTarget.select()} aria-label="page link" />
                  <button type="button" onClick={() => copy(pageUrl, "page")}>{label("page")}</button>
                </div>
                <p className="share__note">a timeline anyone can read.</p>
              </div>

              {withAsk && (
                <div className="share__block">
                  <span className="share__label">for questions <span className="accent">·</span> ask</span>
                  <div className="share__row">
                    <input readOnly value={`${pageUrl}/ask`} onFocus={(e) => e.currentTarget.select()} aria-label="ask link" />
                    <button type="button" onClick={() => copy(`${pageUrl}/ask`, "ask")}>{label("ask")}</button>
                  </div>
                  <p className="share__note">a live chat grounded in the log — anyone can ask.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
