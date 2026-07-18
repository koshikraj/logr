import Link from "next/link";
import { HandleClaim } from "./HandleClaim";
import { HelloNote } from "./HelloNote";
import { RevealObserver } from "./Reveal";
import { AskChat } from "./AskChat";
import { HeroStory } from "./HeroStory";
import { StampFeed } from "./StampFeed";
import { LooksFlip } from "./LooksFlip";
import { ProfileDeck, type FeaturedProfile } from "./ProfileDeck";
import { ProfileMarquee, type LiveProfile } from "./ProfileMarquee";
import { Mark } from "@/components/Mark";
import { AgentAvatar } from "@/components/AgentAvatar";

// The logr marketing landing, cut to the launch promo's rhythm:
// log anything (entries stamp in) → for anyone (real profiles) →
// give it any look (the vitalik screen re-skins itself) → ask it anything →
// three steps → just logr it.
// `signedIn` tailors the nav CTA; `featured` are live profiles from the DB.

const STEPS = [
  ["claim a handle.", "logr.it/you — free forever."],
  ["log a line.", "a date and a sentence. ai drafts the rest."],
  ["every reader follows.", "timeline · llm.txt · /ask — all update at once."],
];

export function Landing({
  signedIn = false,
  featured = [],
  live = [],
}: {
  signedIn?: boolean;
  featured?: FeaturedProfile[];
  live?: LiveProfile[];
}) {
  return (
    <div className="mkt">
      <RevealObserver />
      {/* bar — full-width sticky, line spans the viewport */}
      <header className="bar">
        <div className="bar__inner">
          <Link className="bar__brand" href="/" aria-label="logr"><Mark />logr</Link>
          <nav className="bar__util" aria-label="utilities">
            {signedIn ? (
              <Link href="/dashboard">dashboard</Link>
            ) : (
              <Link href="/login">get started</Link>
            )}
            <a className="cta" href="#claim">claim a handle</a>
          </nav>
        </div>
      </header>
      <div className="page">
        {/* hello — a note from the maker, delivered like a chat message */}
        <section className="hello" aria-label="a note from the maker" data-reveal>
          <Link className="hello__avatar" href="/koshik" aria-label="koshik's logr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/koshik-avatar.webp" alt="koshik" width="96" height="96" />
          </Link>
          <HelloNote />
        </section>

        {/* hero — the wordmark on the left; one line forking to both readers on the right */}
        <section className="hero">
          <div className="hero__main">
            <h1 className="hero__wordmark" aria-label="logr">
              {"logr".split("").map((c, i) => (
                <span key={i} className="wm-letter" style={{ animationDelay: `${0.1 + i * 0.09}s` }}>{c}</span>
              ))}
              <span className="hero__caret" aria-hidden="true" />
            </h1>
            <p className="hero__tag">just logr it</p>
            <p className="hero__lede">log anything. for anyone.</p>
            <p className="hero__sub">one log<span style={{ color: "var(--user-accent)" }}>.</span> every reader.</p>
            <div className="hero__cta">
              <HandleClaim id="handle-hero" />
              <span className="hero__or">or</span>
              <Link className="hero__see" href="/vitalik">see one live →</Link>
            </div>
          </div>
          <HeroStory />
        </section>

        {/* 01 log anything — entries stamp onto the rail, like the promo */}
        <section className="section" data-reveal>
          <div className="section__num section__num--solo">01 — log anything</div>
          <div className="anything">
            <div className="anything__lead">
              <h2 className="anything__head">log<br />anything<span className="colon">.</span></h2>
              <p className="deck__sub">just narrate it — logr picks it up.</p>
            </div>
            <StampFeed />
          </div>
        </section>

        {/* 02 for anyone — real profiles, a highlight sweeping across them,
            plus a slim strip of live profiles drifting underneath */}
        {(featured.length > 0 || live.length > 0) && (
          <section className="section" data-reveal>
            <div className="section__num section__num--solo">02 — for anyone</div>
            {featured.length > 0 && <ProfileDeck profiles={featured} />}
            <ProfileMarquee profiles={live} />
          </section>
        )}

        {/* 03 give it any look — the same log re-skins itself */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">03 — any look</div>
            <div>
              <h2 className="section__title">one log<span className="colon">.</span> give it any look<span className="colon">.</span></h2>
              <p className="section__sub">9 palettes · 8 layouts</p>
            </div>
          </div>
          <LooksFlip />
        </section>

        {/* 04 ask */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">04 — ask</div>
            <div>
              <h2 className="section__title">don&apos;t just scroll<span className="colon">.</span> ask it anything<span className="colon">.</span></h2>
            </div>
          </div>
          <div className="ask">
            <div className="ask__window">
              <div className="ask__bar">
                <span>ask <span className="accent">/</span> vitalik</span>
                <span className="ask__url">logr.it/vitalik</span>
              </div>
              <div className="ask__body">
                <AskChat />
              </div>
            </div>
            <p className="ask__caption">humans ask. <span className="accent">agents ask too.</span></p>
          </div>
        </section>

        {/* 05 how it works — three lines, no wizard */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">05 — how it works</div>
            <div>
              <h2 className="section__title">three steps<span className="colon">.</span> then just keep going<span className="colon">.</span></h2>
            </div>
          </div>
          <div className="strip">
            {STEPS.map(([title, body], i) => (
              <div key={title} className="strip__step">
                <span className="strip__num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="strip__title">{title}</h3>
                <p className="strip__body">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* closing */}
        <section className="closing" id="claim" data-reveal>
          <h2 className="closing__h">just logr it<span className="colon">.</span></h2>
          <div className="closing__form">
            <HandleClaim id="handle-claim" />
          </div>
          <p className="closing__note">free forever · ninety seconds to the first entry</p>
        </section>

        {/* the agent paces along a baseline above the footer — ambient life */}
        <div className="agv-wanderline" aria-hidden="true">
          <span className="agv-wanderer">
            <AgentAvatar state="idle" size={22} />
          </span>
        </div>

        {/* footer */}
        <footer className="foot">
          <div className="foot__grid">
            <div className="foot__brand">
              <span className="foot__wm"><Mark />logr</span>
              <span className="foot__tag">a personal life-log, built for humans and the machines they raise.</span>
            </div>
            <nav className="foot__col" aria-label="product">
              <h4>product</h4>
              <a href="#claim">claim a handle</a>
              <Link href="/explore">explore people</Link>
              <Link href="/vitalik">see an example</Link>
              {signedIn ? (
                <Link href="/dashboard">dashboard</Link>
              ) : (
                <Link href="/login">get started</Link>
              )}
            </nav>
            <nav className="foot__col" aria-label="brand">
              <h4>brand</h4>
              <a href="/vitalik/llm.txt">llm.txt format</a>
              <Link href="/koshik#colophon">colophon</Link>
            </nav>
            <nav className="foot__col" aria-label="elsewhere">
              <h4>elsewhere</h4>
              <a href="https://x.com/uselogr" target="_blank" rel="noopener noreferrer">x · @uselogr</a>
              <a href="https://github.com/koshikraj/logr" target="_blank" rel="noopener noreferrer">github · koshikraj/logr</a>
              <a href="mailto:hello@logr.it">contact · hello@logr.it</a>
            </nav>
          </div>
          <div className="foot__bottom">
            <span className="brand"><Mark />logr &nbsp;— just logr it.</span>
            <span>built in bengaluru <span className="accent">·</span> 2026</span>
            <span><Link href="/koshik">→ view koshik&apos;s logr</Link></span>
          </div>
        </footer>
      </div>
    </div>
  );
}
