// Parse a pasted video link (YouTube / Vimeo / Loom) into an embeddable URL,
// provider, and a poster thumbnail where one is reliably derivable.

export type ParsedVideo = {
  provider: "youtube" | "vimeo" | "loom";
  embedUrl: string;
  poster: string | null;
};

export function parseVideoUrl(raw: string): ParsedVideo | null {
  const url = raw.trim();
  if (!url) return null;

  // YouTube — watch, youtu.be, shorts, embed
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (yt) {
    const id = yt[1];
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  // Vimeo — vimeo.com/123456789 or player.vimeo.com/video/123456789
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`, poster: null };
  }

  // Loom — loom.com/share/<id> or /embed/<id>
  const loom = url.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/);
  if (loom) {
    return { provider: "loom", embedUrl: `https://www.loom.com/embed/${loom[1]}`, poster: null };
  }

  return null;
}

/** Detect an X / Twitter status link and pull out the tweet id. */
export function parseTweetUrl(raw: string): { id: string } | null {
  const m = raw.trim().match(/(?:twitter\.com|x\.com)\/[^/]+\/status(?:es)?\/(\d+)/i);
  return m ? { id: m[1] } : null;
}

/** Detect an Instagram post / reel / tv link. Returns the canonical post URL
 *  (stored on the media row) and the keyless public embed URL (iframed at
 *  render time — Meta's oEmbed API needs an app token, `/embed/` doesn't). */
export function parseInstagramUrl(
  raw: string
): { shortcode: string; postUrl: string; embedUrl: string } | null {
  // covers instagram.com/p/<code>, /reel(s)/<code>, /tv/<code>, and the
  // share form instagram.com/<user>/p/<code>
  const m = raw
    .trim()
    .match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  const type = m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase();
  const shortcode = m[2];
  return {
    shortcode,
    postUrl: `https://www.instagram.com/${type}/${shortcode}/`,
    embedUrl: `https://www.instagram.com/${type}/${shortcode}/embed/`,
  };
}
