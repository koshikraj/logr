"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { updateProfileAction, checkHandleAction } from "@/lib/actions";
import { uploadImage } from "@/lib/upload";
import type { ProfileDTO } from "@/lib/profile";
import { serializeSocials, parseSocials } from "@/lib/socials";

export function ProfileForm({
  profile,
  onDraftChange,
}: {
  profile: ProfileDTO;
  onDraftChange?: (p: Partial<ProfileDTO>) => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [handle, setHandle] = useState(profile.username);
  const [savedUsername, setSavedUsername] = useState(profile.username);
  const [hstate, setHState] = useState<"" | "checking" | "ok" | "taken" | "invalid">("");
  const [herror, setHError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  // handle availability debounce (same flow as onboarding)
  useEffect(() => {
    const h = handle.trim().toLowerCase().replace(/^@/, "");
    if (!h || h === savedUsername) { setHState(""); setHError(null); return; }
    const t = setTimeout(async () => {
      setHState("checking");
      try {
        const r = await checkHandleAction(h);
        setHState(r.available ? "ok" : r.error === "taken" ? "taken" : "invalid");
        setHError(r.available ? null : r.error ?? null);
      } catch {
        setHState("invalid");
        setHError("could not check");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [handle, savedUsername]);

  // report the current (unsaved) field values to the live preview
  function report(avatar = avatarUrl) {
    const form = formRef.current;
    if (!form || !onDraftChange) return;
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? "");
    onDraftChange({
      name: s("name"), username: s("handle").trim().toLowerCase().replace(/^@/, "") || profile.username, bio: s("bio"),
      status: s("status"), location: s("location"), about: s("about"),
      socials: parseSocials(s("socials")), avatarUrl: avatar,
    });
  }

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      setAvatarUrl(url);
      report(url);
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
        ref={formRef}
        onInput={() => report()}
        action={(fd) => {
          fd.set("avatarUrl", avatarUrl);
          start(async () => {
            const res = await updateProfileAction(fd);
            if (res.ok) {
              setSavedUsername(res.username);
              setHandle(res.username);
              toast("Profile saved");
            } else {
              toast(res.error, "error");
            }
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
            <input
              id="f-handle"
              name="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
            />
            {hstate ? (
              <span className={`field__status field__status--${hstate}`}>
                {hstate === "checking" ? (
                  <><span className="field__status__dot" /> checking…</>
                ) : hstate === "ok" ? (
                  <>✓ available</>
                ) : hstate === "taken" ? (
                  <>✕ taken</>
                ) : (
                  <>✕ {herror ?? "invalid"}</>
                )}
              </span>
            ) : (
              <span className="field__hint">your page lives at logr.life/&lt;handle&gt; — changing it changes your URL.</span>
            )}
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
            defaultValue={serializeSocials(profile.socials)}
          />
          <span className="field__hint">one link per line · paste a URL and we&apos;ll detect the platform · or &quot;Label url&quot; for a custom name</span>
        </div>

        <div className="modal__foot" style={{ marginTop: 36 }}>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={pending || hstate === "checking" || hstate === "taken" || hstate === "invalid"}
          >
            {pending ? "saving…" : "save profile →"}
          </button>
        </div>
      </form>
    </section>
  );
}
