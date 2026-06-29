import Link from "next/link";
import { HandleClaim } from "./HandleClaim";
import { RevealObserver } from "./Reveal";
import { ComposeDemo, AskDemo, GrowDemo } from "./StepDemos";
import { HumanVoiceDemo, MachineVoiceChat } from "./DualDemos";
import { Mark } from "@/components/Mark";

// The logr marketing landing. Static brand copy; koshik is the example logr.
// `signedIn` tailors the nav CTA: owners get the dashboard, visitors get started.
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
        {/* hello */}
        <section className="hello" aria-label="a note from the maker" data-reveal>
          <Link className="hello__avatar" href="/koshik" aria-label="koshik's logr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/koshik-avatar.webp" alt="koshik" width="96" height="96" />
          </Link>
          <p className="hello__copy">
            <span className="hi">hi, i&apos;m <Link href="/koshik">koshik</Link>.</span>{" "}
            i kept hitting the same wall: no resume, linkedin, or twitter bio could actually tell my whole story — to a person, or to the agents now reading on their behalf. so i built logr: log every event once, for both.
          </p>
        </section>

        {/* hero */}
        <section className="hero">
          <h1 className="hero__wordmark" aria-label="logr">
            {"logr".split("").map((c, i) => (
              <span key={i} className="wm-letter" style={{ animationDelay: `${0.1 + i * 0.09}s` }}>{c}</span>
            ))}
            <span className="hero__caret" aria-hidden="true" />
          </h1>
          <p className="hero__lede">the story a resume can&apos;t tell. read by humans, ingested by agents.</p>
          <p className="hero__sub">
            a resume, a linkedin, a twitter bio — none of them hold your whole story, and none speak to the agents now reading on someone&apos;s behalf. log every event once. logr makes it a timeline humans read, an{" "}
            <span style={{ color: "var(--user-accent)" }}>llm.txt</span> agents ingest, and a{" "}
            <span style={{ color: "var(--user-accent)" }}>/ask</span> endpoint any agent can query. one log. every reader.
          </p>
          <div className="hero__cta">
            <HandleClaim id="handle-hero" />
            <span className="hero__or">or</span>
            <Link className="hero__see" href="/koshik">see one in motion · logr.life/koshik →</Link>
          </div>
        </section>

        {/* 01 dual reader */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">01 — the duality</div>
            <div>
              <h2 className="section__title">one entry<span className="colon">.</span> every reader<span className="colon">.</span></h2>
              <p className="section__sub">you log it once. humans read your story. agents read your context. the same entry, both ways at once.</p>
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
              <div className="dual__legend"><div>ask it anything about the profile.</div><div>grounded in your log, not the model.</div></div>
            </div>
          </div>
        </section>

        {/* 02 flow */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">02 — how it works</div>
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
                <p className="step__body">your handle is your address. <span style={{ color: "var(--user-accent)" }}>logr.life/koshik</span> — the page, the llm.txt, eventually the chat endpoint. one handle, one life.</p>
              </div>
              <div className="step__demo">
                <div className="preview-window">
                  <div className="preview-window__bar"><span className="preview-window__dots"><span /><span /><span /></span><span className="url">logr.life<span className="accent">/</span>claim</span></div>
                  <div className="preview-window__body">
                    <div className="pw-handle"><span className="prefix">logr.life<span className="accent">/</span></span><span className="name">koshik</span></div>
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
                <p className="step__body">a date and a sentence. that&apos;s the whole format. add a link or a photo if you want. don&apos;t if you don&apos;t.</p>
              </div>
              <div className="step__demo">
                <div className="preview-window">
                  <div className="preview-window__bar"><span className="preview-window__dots"><span /><span /><span /></span><span className="url">logr.life<span className="accent">/</span>koshik<span className="accent">/</span>new</span></div>
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
                <p className="step__body">your timeline updates. your llm.txt regenerates. and one day, your chat endpoint learns the new entry.</p>
              </div>
              <div className="step__demo">
                <div className="pw-triplet">
                  <div className="pw-mini pw-mini--timeline">
                    <div className="pw-mini__bar"><span className="accent">/</span>koshik</div>
                    <div className="pw-mini__body">
                      <div className="pw-mini-entry pw-mini-entry--now"><span className="pw-mini-entry__date">2026.05</span>started logr.</div>
                      <div className="pw-mini-entry"><span className="pw-mini-entry__date">2026.04</span>built sage.</div>
                      <div className="pw-mini-entry"><span className="pw-mini-entry__date">2026.02</span>zhentan.</div>
                    </div>
                  </div>
                  <div className="pw-mini pw-mini--llm">
                    <div className="pw-mini__bar"><span className="accent">/</span>koshik<span className="accent">/</span>llm.txt</div>
                    <div className="pw-mini__body">
                      <pre><span className="k">now:</span> <span className="accent">building sage</span>{"\n"}<span className="k">2026.05</span> started logr{"\n"}<span className="k">2026.04</span> sage on solana{"\n"}<span className="k">2026.02</span> won zhentan</pre>
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
                  <div className="preview-window__bar"><span className="preview-window__dots"><span /><span /><span /></span><span className="url">logr.life<span className="accent">/</span>koshik</span></div>
                  <div className="preview-window__body">
                    <GrowDemo />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03 preview */}
        <section className="section" data-reveal>
          <div className="section__head">
            <div className="section__num">03 — see one</div>
            <div>
              <h2 className="section__title">a logr in motion<span className="colon">.</span></h2>
              <p className="section__sub">koshik&apos;s been keeping his since 2014, retroactively. start today, go back as far as you remember.</p>
            </div>
          </div>
          <Link className="preview" href="/koshik" aria-label="visit koshik's logr">
            <div className="preview__copy">
              <span className="preview__handle">logr.life<span className="accent">/</span>koshik</span>
              <span className="preview__name">koshik raj<span className="colon">:</span></span>
              <p className="preview__bio">a builder. in crypto since 2018, in security since before that. mostly: a quiet bet that this would matter.</p>
              <span className="preview__link">read the full log →</span>
            </div>
            <div className="preview__feed">
              {[
                ["now", "2026.05", "started logr."],
                ["recent", "2026.04", "built sage on solana."],
                ["recent", "2025.11", "devconnect argentina."],
                ["past", "2019.01", "founded consenso labs."],
                ["past", "2014", "mtech, manipal."],
              ].map(([k, d, t]) => (
                <div key={d} className={`preview-entry preview-entry--${k}`}>
                  <span className="preview-entry__dot" aria-hidden="true" />
                  <div className="preview-entry__date">{d}</div>
                  <div className="preview-entry__title">{t}</div>
                </div>
              ))}
            </div>
          </Link>
        </section>

        {/* closing */}
        <section className="closing" id="claim" data-reveal>
          <h2 className="closing__h">log your life<span className="colon">.</span></h2>
          <p className="closing__sub">it takes about ninety seconds to write the first one. the next one waits until you have something to say.</p>
          <div className="closing__form">
            <HandleClaim id="handle-claim" />
          </div>
          <p className="closing__note">free forever for personal logs · early access · no email yet, just your handle</p>
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
              <Link href="/koshik">see an example</Link>
              {signedIn ? (
                <Link href="/dashboard">dashboard</Link>
              ) : (
                <Link href="/login">get started</Link>
              )}
            </nav>
            <nav className="foot__col" aria-label="brand">
              <h4>brand</h4>
              <a href="/koshik/llm.txt">llm.txt format</a>
              <Link href="/koshik#colophon">colophon</Link>
            </nav>
            <nav className="foot__col" aria-label="elsewhere">
              <h4>elsewhere</h4>
              <a href="https://x.com/rajkoshik" target="_blank" rel="noopener noreferrer">x</a>
              <a href="https://github.com/koshikraj" target="_blank" rel="noopener noreferrer">github</a>
              <a href="mailto:hi@logr.life">contact</a>
            </nav>
          </div>
          <div className="foot__bottom">
            <span className="brand"><Mark />logr &nbsp;— log your life.</span>
            <span>built in bengaluru <span className="accent">·</span> 2026</span>
            <span><Link href="/koshik">→ view koshik&apos;s logr</Link></span>
          </div>
        </footer>
      </div>
    </div>
  );
}
