import Link from "next/link";

export type LiveProfile = {
  username: string;
  name: string;
  avatarUrl: string | null;
  events: number;
};

// A slim strip of live profiles drifting under the "for anyone" deck.
// Pure CSS marquee: the list repeats until the row is wide enough, then the
// whole set renders twice and slides -50% on a loop (pauses on hover;
// reduced motion swaps it for a plain scrollable row).
const MIN_CARDS = 8;
const SECS_PER_CARD = 4;

export function ProfileMarquee({ profiles }: { profiles: LiveProfile[] }) {
  if (profiles.length === 0) return null;
  const loop: LiveProfile[] = [];
  while (loop.length < Math.max(MIN_CARDS, profiles.length)) loop.push(...profiles);

  return (
    <div className="mq" aria-label="more people logging, live">
      <div className="mq__track" style={{ animationDuration: `${loop.length * SECS_PER_CARD}s` }}>
        {[0, 1].map((copy) => (
          // the second set exists only to make the loop seamless
          <div className="mq__set" key={copy} aria-hidden={copy === 1 || undefined}>
            {loop.map((p, i) => (
              <Link
                key={`${p.username}-${i}`}
                href={`/${p.username}`}
                className="mq__card"
                tabIndex={copy === 1 || i >= profiles.length ? -1 : undefined}
                aria-label={`${p.name}'s logr`}
              >
                <span className="mq__photo" aria-hidden="true">
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="mq__initial">{p.name.charAt(0).toLowerCase()}</span>
                  )}
                </span>
                <span className="mq__copy">
                  <span className="mq__name">{p.name.toLowerCase()}</span>
                  <span className="mq__meta">
                    <span className="accent">/</span>
                    {p.username} · {p.events} events
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
