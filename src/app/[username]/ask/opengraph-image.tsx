import { ImageResponse } from "next/og";
import { getProfile } from "@/lib/profile";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ username: string }> };

const INK    = "#1a1a1a";
const PAPER  = "#faf8f3";
const CANVAS = "#e0dbd0";
const MUTED  = "#6b6862";
const FAINT  = "#95918a";
const ACCENT = "#d85a30";
const RULE   = "rgba(26,26,26,0.12)";

function LogrMark({ px = 18 }: { px?: number }) {
  const top = Math.round(px * 0.34);
  const bot = Math.round(px * 0.2);
  const gap = Math.round(px * 0.18);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap, marginBottom: 1 }}>
      <div style={{ width: top, height: top, borderRadius: "50%", background: ACCENT }} />
      <div style={{ width: bot, height: bot, borderRadius: "50%", background: INK }} />
    </div>
  );
}

export default async function OgImage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return new Response("Not found", { status: 404 });

  const first = profile.name.split(" ")[0].toLowerCase();
  const prompts = [
    `what is ${first} building now?`,
    "what have they shipped recently?",
    "what's their background?",
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: CANVAS,
          display: "flex",
          padding: "44px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* shadow behind the card */}
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 50,
            right: 50,
            bottom: 36,
            borderRadius: "22px",
            background: "rgba(0,0,0,0.20)",
          }}
        />

        {/* card */}
        <div
          style={{
            width: "100%",
            height: "100%",
            background: PAPER,
            border: "1px solid rgba(26,26,26,0.07)",
            borderRadius: "18px",
            display: "flex",
            flexDirection: "column",
            padding: "52px 56px",
          }}
        >
          {/* handle */}
          <div style={{ display: "flex", fontSize: 17, color: MUTED, fontFamily: "monospace", letterSpacing: "0.07em" }}>
            logr.life<span style={{ color: ACCENT }}>/</span>{username}<span style={{ color: ACCENT }}>/</span>ask
          </div>

          {/* title */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              marginTop: 18,
              fontSize: 78,
              letterSpacing: "-0.035em",
              lineHeight: 1.0,
              color: INK,
            }}
          >
            ask {profile.name}
            <div style={{ width: 5, height: 60, background: ACCENT, marginLeft: 9, marginBottom: 8, flexShrink: 0 }} />
          </div>
          <div style={{ display: "flex", fontSize: 27, color: MUTED, fontStyle: "italic", marginTop: 14, maxWidth: 880, lineHeight: 1.4 }}>
            a grounded conversation — answers only from what&apos;s in {first}&apos;s log, nothing invented.
          </div>

          {/* faux starter prompts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 40 }}>
            {prompts.map((p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  fontFamily: "monospace",
                  fontSize: 19,
                  color: INK,
                  border: `1px solid ${RULE}`,
                  borderRadius: 12,
                  padding: "12px 20px",
                  background: "#fff",
                }}
              >
                {p}
              </div>
            ))}
          </div>

          {/* spacer */}
          <div style={{ flex: 1 }} />

          {/* footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingTop: 22,
              borderTop: `1px solid ${RULE}`,
            }}
          >
            <span style={{ display: "flex", fontFamily: "monospace", fontSize: 15, color: FAINT, letterSpacing: "0.08em" }}>
              read by humans · ingested by machines
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <LogrMark px={16} />
              <span style={{ fontFamily: "Georgia, serif", fontSize: 19, letterSpacing: "-0.045em", color: MUTED, lineHeight: 1 }}>
                logr
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
