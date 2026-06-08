"use client";

import { useState, useRef, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { updateProfileAction } from "@/lib/actions";
import { uploadImage } from "@/lib/upload";
import type { ProfileDTO } from "@/lib/profile";

export function ProfileForm({ profile }: { profile: ProfileDTO }) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      setAvatarUrl(await uploadImage(file));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section role="tabpanel">
      <form
        className="card"
        action={(fd) => {
          fd.set("avatarUrl", avatarUrl);
          start(async () => {
            await updateProfileAction(fd);
            toast("Profile saved");
          });
        }}
      >
        <div className="card__head">
          <span className="card__head__title">profile <span className="accent">/</span> who you are, in your own words</span>
        </div>

        <div className="field">
          <span className="field__label">avatar</span>
          <div className="field-avatar">
            <span className="field-avatar__thumb">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" />
              ) : (
                <span className="field-avatar__thumb__initial">{(profile.name.trim()[0] || "·").toLowerCase()}</span>
              )}
            </span>
            <p className="field-avatar__hint">
              {busy ? "uploading…" : <>a square image, 256px minimum — <span className="accent" onClick={() => fileRef.current?.click()}>choose a file</span></>}
            </p>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files?.[0])} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="f-name">name</label>
            <input id="f-name" name="name" type="text" defaultValue={profile.name} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="f-handle">handle</label>
            <input id="f-handle" name="handle" type="text" defaultValue={profile.handle} />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="f-bio">bio</label>
          <textarea id="f-bio" name="bio" rows={2} defaultValue={profile.bio} />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="f-status">status</label>
            <input id="f-status" name="status" type="text" defaultValue={profile.status} placeholder="building …" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="f-location">location</label>
            <input id="f-location" name="location" type="text" defaultValue={profile.location} />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="f-about">about</label>
          <textarea id="f-about" name="about" rows={6} defaultValue={profile.about ?? ""} />
          <span className="field__hint">use a blank line between paragraphs.</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="f-socials">socials</label>
          <textarea
            id="f-socials"
            name="socials"
            rows={3}
            defaultValue={profile.socials
              .map((s) => {
                const cleanLabel = s.label.trim().toLowerCase()
                  .replace(/^(?:https?:\/\/)?(?:www\.)?/i, "")
                  .replace(/^mailto:/i, "")
                  .replace(/\/$/, "");
                const cleanHref = s.href.trim().toLowerCase()
                  .replace(/^(?:https?:\/\/)?(?:www\.)?/i, "")
                  .replace(/^mailto:/i, "")
                  .replace(/\/$/, "");
                if (cleanLabel === cleanHref) {
                  return s.label;
                }
                return `${s.label} ${s.href}`;
              })
              .join("\n")}
          />
          <span className="field__hint">one per line · &lt;label&gt; &lt;url&gt;</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="f-activeOrbit">active_orbit</label>
          <textarea
            id="f-activeOrbit"
            name="activeOrbit"
            rows={2}
            defaultValue={profile.activeOrbit || ""}
            placeholder="e.g. Seeking Summer '26 Internships&#10;ISYA Space Research"
          />
          <span className="field__hint">one focus area per line</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="f-dsaMetrics">dsa_metrics</label>
          <textarea
            id="f-dsaMetrics"
            name="dsaMetrics"
            rows={2}
            defaultValue={profile.dsaMetrics || ""}
            placeholder="e.g. Java: Stable&#10;Python: Stable"
          />
          <span className="field__hint">one metric per line · &lt;language&gt;: &lt;status&gt;</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="f-sysArchitecture">sys_architecture</label>
          <input
            id="f-sysArchitecture"
            name="sysArchitecture"
            type="text"
            defaultValue={profile.sysArchitecture || ""}
            placeholder="e.g. Docker, PyTorch, Flutter, Python"
          />
          <span className="field__hint">comma-separated tech stack</span>
        </div>

        <div className="modal__foot" style={{ marginTop: 36 }}>
          <button type="submit" className="btn btn--primary" disabled={pending}>
            {pending ? "saving…" : "save profile →"}
          </button>
        </div>
      </form>
    </section>
  );
}
