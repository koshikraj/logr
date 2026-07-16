"use client";

// Step-2 "sources" intake: paste URLs (classified into chips instantly) and
// drop resume / LinkedIn-export files. Parsing happens after publish, in the
// background — this component only collects the list.

import { useCallback, useEffect, useRef, useState } from "react";
import { classifySource, isUncrawlable } from "@/lib/import-classify";
import type { SourceKind } from "@/lib/import-types";

export type ImportFile = { file: File; kind: "resume" | "linkedin-pdf" };

export type PendingSource =
  | { id: string; kind: SourceKind; label: string; url: string; blocked?: boolean }
  | { id: string; kind: "resume" | "linkedin-pdf"; label: string; file: File };

const KIND_GLYPH: Record<string, string> = {
  github: "gh",
  rss: "rss",
  devto: "dev",
  youtube: "yt",
  site: "www",
  linkedin: "in",
  resume: "cv",
  "linkedin-pdf": "in",
};

let nextId = 1;
const uid = () => `src-${nextId++}`;

export function SourcesInput({
  linkedinEnabled,
  onChange,
}: {
  linkedinEnabled: boolean;
  onChange: (urls: string[], files: ImportFile[]) => void;
}) {
  const [pending, setPending] = useState<PendingSource[]>([]);
  const [draft, setDraft] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const linkedinHint = pending.some((p) => p.kind === "linkedin" && "blocked" in p && p.blocked);

  useEffect(() => {
    const urls = pending
      .filter((p): p is Extract<PendingSource, { url: string }> => "url" in p && !p.blocked)
      .map((p) => p.url);
    const files = pending
      .filter((p): p is Extract<PendingSource, { file: File }> => "file" in p)
      .map((p) => ({ file: p.file, kind: p.kind as ImportFile["kind"] }));
    onChange(urls, files);
  }, [pending, onChange]);

  const addUrls = useCallback(
    (text: string) => {
      const tokens = text.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
      if (!tokens.length) return;
      setWarn(null);
      setPending((prev) => {
        const next = [...prev];
        for (const token of tokens) {
          if (isUncrawlable(token)) {
            setWarn(`we can't read ${token.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]} — it blocks robots. link it in your socials instead.`);
            continue;
          }
          const c = classifySource(token);
          if (!c) {
            setWarn(`"${token.slice(0, 40)}" doesn't look like a link we can read.`);
            continue;
          }
          if (next.some((p) => "url" in p && p.url === c.url)) continue;
          const blocked = c.kind === "linkedin" && !linkedinEnabled;
          next.push({ id: uid(), kind: c.kind, label: c.label, url: c.url, blocked });
        }
        return next.slice(0, 8);
      });
    },
    [linkedinEnabled]
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setWarn(null);
      setPending((prev) => {
        const next = [...prev];
        for (const file of Array.from(files)) {
          const name = file.name.toLowerCase();
          if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
            setWarn("only PDF and DOCX files work here.");
            continue;
          }
          if (file.size > 5 * 1024 * 1024) {
            setWarn(`${file.name} is too large (max 5 MB).`);
            continue;
          }
          if (next.some((p) => "file" in p && p.label === file.name)) continue;
          // A PDF dropped while a LinkedIn link is waiting (or named like one)
          // is treated as the LinkedIn profile export.
          const pendingLinkedIn = next.some((p) => p.kind === "linkedin" && "blocked" in p && p.blocked);
          const kind: "resume" | "linkedin-pdf" =
            name.includes("linkedin") || pendingLinkedIn ? "linkedin-pdf" : "resume";
          next.push({ id: uid(), kind, label: file.name.slice(0, 60), file });
        }
        return next.slice(0, 8);
      });
    },
    []
  );

  const submitDraft = () => {
    if (draft.trim()) {
      addUrls(draft);
      setDraft("");
    }
  };

  return (
    <div
      className={`onb2-drop${dragging ? " onb2-drop--drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div className="onb2-drop__row">
        <input
          className="onb2-drop__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitDraft();
            }
          }}
          onBlur={submitDraft}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text.trim()) {
              e.preventDefault();
              addUrls(text);
            }
          }}
          placeholder="portfolio, github, blog, youtube… ⏎"
          autoFocus
        />
        <button type="button" className="onb2-filebtn" onClick={() => fileInputRef.current?.click()}>
          + resume
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {pending.length > 0 && (
        <div className="onb2-chips">
          {pending.map((p) => (
            <span
              key={p.id}
              className={`onb2-chip${"blocked" in p && p.blocked ? " onb2-chip--hint" : ""}`}
            >
              <span className="onb2-chip__kind">{KIND_GLYPH[p.kind] ?? "www"}</span>
              <span className="onb2-chip__label">{p.label}</span>
              <button
                type="button"
                className="onb2-chip__x"
                aria-label={`remove ${p.label}`}
                onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {linkedinHint && (
        <p className="onb2-warn">
          linkedin blocks robots — export your profile as PDF (Profile → Resources → Save to PDF) and drop it
          here instead.
        </p>
      )}
      {warn && <p className="onb2-warn">{warn}</p>}
      <span className="onb2-drop__help">drop a resume PDF/DOCX anywhere in this box.</span>
    </div>
  );
}
