import Link from "next/link";
import { HandleClaim } from "./HandleClaim";
import { HelloNote } from "./HelloNote";
import { RevealObserver } from "./Reveal";
import { ComposeDemo, AskDemo, GrowDemo } from "./StepDemos";
import { HumanVoiceDemo, MachineVoiceChat } from "./DualDemos";
import { Mark } from "@/components/Mark";

// The logr marketing landing, structured after the launch promo:
// log anything → give it any look → a logr in motion (vitalik) →
// don't just scroll, ask → how it works → just logr it.
// `signedIn` tailors the nav CTA: owners get the dashboard, visitors get started.

// The same white-paper entry, rendered in four of the app's looks.
const LOOKS = [
  {
    label: "paper · timeline",
    canvas: { background: "#FAF8F3" },
    body: (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#D85A30", marginTop: 5, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#6B6862", letterSpacing: "0.04em" }}>2013.11</div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 13.5, color: "#1A1A1A", marginTop: 3, lineHeight: 1.35 }}>
            published the ethereum white paper
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "ink · terminal",
    canvas: { background: "#1A1814" },
    body: (
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.6 }}>
        <span style={{ color: "#D85A30" }}>&gt; </span>
        <span style={{ color: "#8E8A82" }}>[2013.11]</span>
        <br />
        <span style={{ color: "#F2EFE8" }}>published the ethereum white paper</span>
        <span style={{ display: "inline-block", width: 6, height: 12, background: "#D85A30", marginLeft: 5, verticalAlign: "-2px" }} />
      </div>
    ),
  },
  {
    label: "sepia · polaroid",
    canvas: { background: "#F4EBD9" },
    body: (
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ background: "#fff", padding: "3px 3px 9px", borderRadius: 2, boxShadow: "0 8px 18px -8px rgba(0,0,0,0.3)", transform: "rotate(-4deg)", flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/whitepaper.svg" alt="" width="34" height="34" style={{ display: "block" }} />
        </span>
        <div style={{ fontFamily: "var(--serif)", fontSize: 12.5, color: "#241E14", lineHeight: 1.35 }}>
          published the ethereum white paper
        </div>
      </div>
    ),
  },
  {
    label: "paper · magazine",
    canvas: { background: "#FAF8F3" },
    body: (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "#D85A30", marginTop: 2 }}>06</span>
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 13.5, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.35 }}>
            published the ethereum white paper
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "#95918A", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>
            · writing
          </div>
        </div>
      </div>
    ),
  },
];

const VITALIK_FEED: [string, string, string, string, string][] = [
  ["now", "2026.06", "kicked off 'obfuscation: the final boss of cryptography'.", "part i of a new series on my blog.", "/icons/cipher-boss.svg"],
  ["recent", "2025.07", "wrote 'my response to ai 2027'.", "are timelines that fast actually plausible?", "/icons/ai-reply.svg"],
  ["recent", "2023.11", "wrote 'my techno-optimism'.", "the direction of progress matters, not just the magnitude.", "/icons/optimism-path.svg"],
  ["past", "2022.02", "“ethereum is neutral, but i am not.”", "said plainly, the day the war began.", "/icons/split-diamond.svg"],
  ["past", "2015", "deployed the ethereum blockchain.", "a decentralised mining network and dev platform in one.", "/icons/blockchain.svg"],
  ["past", "2013.11", "published the ethereum white paper.", "a more general scripting language. a new platform.", "/icons/whitepaper.svg"],
];

export function Landing({ signedIn = false }: { signedIn?: boolean }) {
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

        {/* hero — the mark, the wordmark, the tagline. claiming stays the first act. */}
        <section className="hero">
          <h1 className="hero__wordmark" aria-label="logr">
            {"logr".split("").map((c, i) => (
              <span key={i} className="wm-letter" style={{ animationDelay: `${0.1 + i * 0.09}s` }}>{c}</span>
            ))}
            <span className="hero__caret" aria-hidden="true" />
          </h1>
          <p className="hero__tag">just logr it</p>
          <p className="hero__lede">log anything. for anyone.</p>
          <p className="hero__sub">
            just narrate your story — logr picks it up. every event becomes a timeline humans read, an{" "}
            <span style={{ color: "var(--user-accent)" }}>llm.txt</span> agents ingest, and an{" "}
            <span style={{ color: "var(--user-accent)" }}>/ask</span> anyone can question. one log. every reader.
          </p>
          <div className="hero__cta">
            <HandleClaim id="handle-hero" />
            <span className="hero__or">or</span>
            <Link className="hero__see" href="/vitalik">see one in motion · logr.life/vitalik →</Link>
          </div>
        </section>

        {/* 01 log anything */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">01 — log anything</div>
            <div>
              <h2 className="section__title">log anything<span className="colon">.</span> for anyone<span className="colon">.</span></h2>
              <p className="section__sub">a launch. a marathon. a terrible first pot. if it happened, it can be logged.</p>
            </div>
          </div>
          <div className="preview">
            <div className="preview__copy">
              <span className="preview__handle">logr.life<span className="accent">/</span>asha</span>
              <span className="preview__name">asha<span className="colon">:</span></span>
              <p className="preview__bio">shipped an app in january. quit big tech in july. logged all of it, one line at a time.</p>
              <p className="preview__roles">for artists <span className="accent">·</span> founders <span className="accent">·</span> influencers <span className="accent">·</span> devs <span className="accent">·</span> anyone</p>
              <a className="preview__link" href="#claim">start yours →</a>
            </div>
            <div className="preview__feed">
              {[
                ["past", "2026.01", "shipped my first app.", "built on weekends, in public. go break it.", "/icons/app-launch.svg"],
                ["recent", "2026.03", "ran a half marathon.", "2:19. the last two km were a negotiation.", "/icons/marathon.svg"],
                ["recent", "2026.05", "started pottery. terrible at it.", "the bowls are lopsided. the saturdays are perfect.", "/icons/pottery.svg"],
                ["now", "2026.07", "wrote about leaving big tech.", "four drafts for the essay. four months to hit publish.", "/icons/essay-exit.svg"],
              ].map(([k, d, t, b, icon]) => (
                <div key={d} className={`preview-entry preview-entry--${k}`}>
                  <span className="preview-entry__dot" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="preview-entry__icon" src={icon} alt="" width="38" height="38" />
                  <div className="preview-entry__date">{d}</div>
                  <div className="preview-entry__title">{t}</div>
                  <p className="preview-entry__body">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 02 give it any look */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">02 — one log, any look</div>
            <div>
              <h2 className="section__title">give it any look<span className="colon">.</span></h2>
              <p className="section__sub">9 palettes · 8 layouts. the same entry, wearing whatever suits you.</p>
            </div>
          </div>
          <div className="looks">
            {LOOKS.map((l) => (
              <div key={l.label} className="look" data-reveal>
                <div className="look__canvas" style={l.canvas}>{l.body}</div>
                <div className="look__label"><span>{l.label}</span><span className="accent">→</span></div>
              </div>
            ))}
          </div>
        </section>

        {/* 03 a logr in motion — vitalik, the main story */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">03 — see one</div>
            <div>
              <h2 className="section__title">a logr in motion<span className="colon">.</span></h2>
              <p className="section__sub">a whole life in one log: essays, donations, one famous tweet. thirteen years, still going.</p>
            </div>
          </div>
          <Link className="preview" href="/vitalik" aria-label="visit vitalik's logr">
            <div className="preview__copy">
              <span className="preview__avatar" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marketing/vitalik.jpg" alt="" />
              </span>
              <span className="preview__handle">logr.life<span className="accent">/</span>vitalik</span>
              <span className="preview__name">vitalik buterin<span className="colon">:</span></span>
              <p className="preview__bio">wrote the ethereum white paper at nineteen. the log runs from a bitcoin forum in 2011 to the final boss of cryptography.</p>
              <span className="preview__link">read the full log →</span>
            </div>
            <div className="preview__feed">
              {VITALIK_FEED.map(([k, d, t, b, icon]) => (
                <div key={d} className={`preview-entry preview-entry--${k}`}>
                  <span className="preview-entry__dot" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="preview-entry__icon" src={icon} alt="" width="38" height="38" />
                  <div className="preview-entry__date">{d}</div>
                  <div className="preview-entry__title">{t}</div>
                  <p className="preview-entry__body">{b}</p>
                </div>
              ))}
            </div>
          </Link>
        </section>

        {/* 04 dual reader */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">04 — the duality</div>
            <div>
              <h2 className="section__title">don&apos;t just scroll<span className="colon">.</span> ask it anything<span className="colon">.</span></h2>
              <p className="section__sub">one entry, two readers. humans read the story. agents ask the log. the same life, both ways at once.</p>
            </div>
          </div>
          <div className="dual">
            <div className="dual__col">
              <div className="dual__head"><span>the human voice</span><span className="accent">serif</span></div>
              <HumanVoiceDemo />
              <div className="dual__legend"><div>read at the speed of a sentence.</div><div>noticed by a person who knows you.</div></div>
            </div>
            <div className="dual__col">
              <div className="dual__head"><span>the machine voice</span><span className="accent">/ ask</span></div>
              <MachineVoiceChat />
              <div className="dual__legend"><div>ask it anything about the profile.</div><div>grounded in the log, not the model.</div></div>
            </div>
          </div>
        </section>

        {/* 05 flow */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">05 — how it works</div>
            <div>
              <h2 className="section__title">four steps<span className="colon">.</span> the fourth never ends<span className="colon">.</span></h2>
              <p className="section__sub">no wizard, no profile to polish. log a sentence, hit save, walk away.</p>
            </div>
          </div>
          <div className="flow">
            <div className="step" data-reveal>
              <div className="step__num">01</div>
              <div className="step__copy">
                <h3 className="step__title">claim a handle.</h3>
                <p className="step__body">your handle is your address. <span style={{ color: "var(--user-accent)" }}>logr.life/asha</span> — the page, the llm.txt, the ask-anything chat. one handle, one life.</p>
              </div>
              <div className="step__demo">
                <div className="preview-window">
                  <div className="preview-window__bar"><span className="preview-window__dots"><span /><span /><span /></span><span className="url">logr.life<span className="accent">/</span>claim</span></div>
                  <div className="preview-window__body">
                    <div className="pw-handle"><span className="prefix">logr.life<span className="accent">/</span></span><span className="name">asha</span></div>
                    <div className="pw-row"><span className="pill">available</span><span>· <span className="accent">free</span> forever</span></div>
                    <div className="pw-cta"><span className="pw-cta__btn">claim →</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="step" data-reveal>
              <div className="step__num">02</div>
              <div className="step__copy">
                <h3 className="step__title">add an entry.</h3>
                <p className="step__body">just narrate it — a date and a sentence. add a link or a photo if you want. or paste your whole story and ai drafts the events for you to review.</p>
              </div>
              <div className="step__demo">
                <div className="preview-window">
                  <div className="preview-window__bar"><span className="preview-window__dots"><span /><span /><span /></span><span className="url">logr.life<span className="accent">/</span>asha<span className="accent">/</span>new</span></div>
                  <div className="preview-window__body">
                    <ComposeDemo />
                  </div>
                </div>
              </div>
            </div>
            <div className="step" data-reveal>
              <div className="step__num">03</div>
              <div className="step__copy">
                <h3 className="step__title">it becomes three things.</h3>
                <p className="step__body">your timeline updates. your llm.txt regenerates. and your chat answers visitors with the new entry — grounded in your log, nothing else.</p>
              </div>
              <div className="step__demo">
                <div className="pw-triplet">
                  <div className="pw-mini pw-mini--timeline">
                    <div className="pw-mini__bar"><span className="accent">/</span>asha</div>
                    <div className="pw-mini__body">
                      <div className="pw-mini-entry pw-mini-entry--now"><span className="pw-mini-entry__date">2026.07</span>left big tech.</div>
                      <div className="pw-mini-entry"><span className="pw-mini-entry__date">2026.05</span>started pottery.</div>
                      <div className="pw-mini-entry"><span className="pw-mini-entry__date">2026.03</span>half marathon.</div>
                    </div>
                  </div>
                  <div className="pw-mini pw-mini--llm">
                    <div className="pw-mini__bar"><span className="accent">/</span>asha<span className="accent">/</span>llm.txt</div>
                    <div className="pw-mini__body">
                      <pre><span className="k">now:</span> <span className="accent">writing what&apos;s next</span>{"\n"}<span className="k">2026.07</span> left big tech{"\n"}<span className="k">2026.05</span> started pottery{"\n"}<span className="k">2026.03</span> half marathon</pre>
                    </div>
                  </div>
                  <AskDemo />
                </div>
              </div>
            </div>
            <div className="step" data-reveal>
              <div className="step__num">04</div>
              <div className="step__copy">
                <h3 className="step__title">keep going.</h3>
                <p className="step__body">one entry a year. one a week. one on a tuesday because the bread was good. a life is never done. logr is never sealed.</p>
              </div>
              <div className="step__demo">
                <div className="preview-window">
                  <div className="preview-window__bar"><span className="preview-window__dots"><span /><span /><span /></span><span className="url">logr.life<span className="accent">/</span>asha</span></div>
                  <div className="preview-window__body">
                    <GrowDemo />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* closing */}
        <section className="closing" id="claim" data-reveal>
          <h2 className="closing__h">just logr it<span className="colon">.</span></h2>
          <p className="closing__sub">it takes about ninety seconds to write the first one. the next one waits until you have something to say.</p>
          <div className="closing__form">
            <HandleClaim id="handle-claim" />
          </div>
          <p className="closing__note">free forever for personal logs · early access · ninety seconds to the first entry</p>
        </section>

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
              <a href="mailto:hello@logr.life">contact · hello@logr.life</a>
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
