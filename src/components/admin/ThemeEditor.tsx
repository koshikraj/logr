"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { updateThemeAction } from "@/lib/actions";
import { PALETTES, LAYOUTS, DEFAULT_VIEWS, resolvePalette, type Theme } from "@/lib/theme";
import { LAYOUT_ICONS } from "@/components/layout-icons";

const ACCENTS = [
  { hex: "#D85A30", name: "coral" },
  { hex: "#3E6B4A", name: "forest" },
  { hex: "#1A73C4", name: "cobalt" },
  { hex: "#7A4EE0", name: "iris" },
  { hex: "#B89640", name: "ochre" },
  { hex: "#C24A6A", name: "rose" },
  { hex: "#306B68", name: "teal" },
  { hex: "#1A1A1A", name: "ink" },
];

export function ThemeEditor({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (t: Theme) => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function set<K extends keyof Theme>(k: K, v: Theme[K]) {
    onChange({ ...theme, [k]: v });
  }

  function save() {
    start(async () => {
      await updateThemeAction(theme);
      toast("Theme saved");
    });
  }

  const p = resolvePalette(theme);
  const accent = theme.accentOverride || p.accent;

  return (
    <section role="tabpanel">
      <div className="card">
        <div className="card__head">
          <span className="card__head__title">appearance <span className="accent">/</span> the look of your logr</span>
        </div>

        <div className="theme-preview">
          <div className="theme-preview__copy">
            <h3 className="theme-preview__name">{p.name}</h3>
            <p className="theme-preview__sub">{p.note} · {theme.layout}</p>
          </div>
          <div className="theme-preview__chips">
            {[p.ink, p.paper, accent, p.muted].map((c, i) => (
              <span key={i} className="theme-preview__chip" style={{ background: c }} />
            ))}
          </div>
        </div>

        {/* palette swatches */}
        <div className="field">
          <span className="field__label">palette</span>
          <div className="opt-grid opt-grid--pal">
            {Object.entries(PALETTES).map(([key, pal]) => (
              <button
                key={key}
                type="button"
                className="opt opt--pal"
                aria-current={theme.palette === key}
                onClick={() => set("palette", key)}
              >
                <span className="opt__chip" style={{ background: pal.paper }}>
                  <span className="opt__chip__ink" style={{ background: pal.ink }} />
                  <span className="opt__chip__acc" style={{ background: pal.accent }} />
                </span>
                <span className="opt__copy">
                  <span className="opt__name">{pal.name}</span>
                  <span className="opt__note">{pal.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* layout options with icons + details */}
        <div className="field">
          <span className="field__label">default layout</span>
          <div className="opt-grid opt-grid--lay">
            {Object.entries(LAYOUTS).map(([key, l]) => (
              <button
                key={key}
                type="button"
                className="opt opt--lay"
                aria-current={theme.layout === key}
                onClick={() => set("layout", key)}
              >
                <span className="opt__icon">{LAYOUT_ICONS[key]}</span>
                <span className="opt__copy">
                  <span className="opt__name">{l.name}</span>
                  <span className="opt__note">{l.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* default view — which event order the timeline opens on */}
        <div className="field">
          <span className="field__label">default view — how visitors first see your log</span>
          <div className="opt-grid opt-grid--lay">
            {DEFAULT_VIEWS.map((v) => (
              <button
                key={v.v}
                type="button"
                className="opt opt--lay"
                aria-current={(theme.defaultView ?? "newest") === v.v}
                onClick={() => set("defaultView", v.v)}
              >
                <span className="opt__copy">
                  <span className="opt__name">{v.label}</span>
                  <span className="opt__note">{v.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* accent */}
        <div className="field">
          <span className="field__label">accent — your personal colour</span>
          <div className="swatches">
            <button
              type="button"
              className="sw sw--auto"
              aria-current={theme.accentOverride === null}
              title="match palette"
              onClick={() => set("accentOverride", null)}
            >
              auto
            </button>
            {ACCENTS.map((a) => (
              <button
                key={a.hex}
                type="button"
                className="sw"
                style={{ background: a.hex }}
                aria-current={theme.accentOverride?.toLowerCase() === a.hex.toLowerCase()}
                aria-label={a.name}
                title={a.name}
                onClick={() => set("accentOverride", a.hex)}
              />
            ))}
          </div>
        </div>

        <div className="modal__foot" style={{ marginTop: 36 }}>
          <button type="button" className="btn btn--primary" onClick={save} disabled={pending}>
            {pending ? "saving…" : "save theme →"}
          </button>
        </div>
      </div>
    </section>
  );
}
