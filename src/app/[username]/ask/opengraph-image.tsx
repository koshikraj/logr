import { ImageResponse } from "next/og";
import { getProfile } from "@/lib/profile";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ username: string }> };

// Share card for /[username]/ask — palette mirrors the other OG cards.
const INK = "#1a1a1a";
const PAPER = "#faf8f3";
const CANVAS = "#e0dbd0";
const MUTED = "#6b6862";
const ACCENT = "#d85a30";
const RULE = "rgba(26,26,26,0.12)";

export default async function OgImage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return new Response("Not found", { status: 404 });

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
            gap: 26,
          }}
        >
          <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
            logr.it<span style={{ color: ACCENT }}>/</span>{username}<span style={{ color: ACCENT }}>/</span>ask
          </div>
          <div style={{ display: "flex", fontSize: 64, color: INK, letterSpacing: -2, textAlign: "center", maxWidth: 900 }}>
            ask {profile.name.toLowerCase()} anything
          </div>
          <div style={{ display: "flex", fontSize: 24, color: MUTED, textAlign: "center", maxWidth: 780 }}>
            a grounded conversation — answers come only from the log, never invented.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: ACCENT }} />
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: INK }} />
            </div>
            <div style={{ display: "flex", fontSize: 26, color: INK }}>logr</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
