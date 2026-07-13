import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand OG card for the marketing homepage — palette mirrors the profile
// OG image (opengraph-image.tsx in [username]).
const INK = "#1a1a1a";
const PAPER = "#faf8f3";
const CANVAS = "#e0dbd0";
const MUTED = "#6b6862";
const ACCENT = "#d85a30";
const RULE = "rgba(26,26,26,0.12)";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: CANVAS,
        }}
      >
        <div
          style={{
            width: 1040,
            height: 470,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: PAPER,
            border: `1px solid ${RULE}`,
            boxShadow: "0 24px 80px rgba(26,26,26,0.18)",
            gap: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: ACCENT }} />
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: INK }} />
            </div>
            <div style={{ display: "flex", fontSize: 96, color: INK, letterSpacing: -4 }}>
              logr<span style={{ color: ACCENT }}>:</span>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 34, color: INK }}>just logr it.</div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED, textAlign: "center", maxWidth: 760 }}>
            one timeline humans read — and agents can just ask.
          </div>
          <div style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 8 }}>
            logr<span style={{ color: ACCENT }}>.</span>life
          </div>
        </div>
      </div>
    ),
    size
  );
}
