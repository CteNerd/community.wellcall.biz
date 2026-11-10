import { brand } from "./branding.ts";
import { readPresentation } from "./presentation.ts";
import "./style.css";

const pathways = [
  {
    number: "01",
    category: "Skills & technology",
    title: "Technology + AI",
    description:
      "Learn by making: break a real-world challenge into smaller questions, build a practical project, and develop good judgment about the tools—including AI.",
    status: "Planned adult pathway",
    tone: "citrus",
  },
  {
    number: "02",
    category: "People & perspective",
    title: "Mentorship",
    description:
      "A thoughtful one-to-one model built around shared goals, consistent practice, honest feedback, and clear expectations for both people.",
    status: "Planned adult pathway",
    tone: "sky",
  },
  {
    number: "03",
    category: "Performance & movement",
    title: "Athletics + fitness",
    description:
      "A future direction for performance, athletic practice, and fitness—not an active training program, medical service, or place to register.",
    status: "Future concept",
    tone: "peach",
  },
];

const practiceSteps = [
  {
    number: "01",
    title: "Choose a skill to stretch",
    description:
      "Name something you want to understand or make. Start with a real question, not a track chosen for you.",
  },
  {
    number: "02",
    title: "Build a small project",
    description:
      "Turn that question into something you can test. Choose tools that fit the task and keep the result small enough to finish.",
  },
  {
    number: "03",
    title: "Use feedback to revise",
    description:
      "Show what you made, ask questions, and decide what to change. Feedback should explain the work—not label the person.",
  },
  {
    number: "04",
    title: "Choose what to try next",
    description:
      "Notice what you can do now and what still needs practice. Set one realistic next challenge; progress is personal, not promised.",
  },
];

const questions = [
  {
    question: "Can I apply, enroll, or book a mentor now?",
    answer:
      "No. Public enrollment and mentor applications are closed. This website explains the direction of the work; it does not collect applications, reserve a place, or create a mentor relationship.",
  },
  {
    question: "Who is the first planned program for?",
    answer:
      "The initial concept is an adult technology and mentorship pilot. It is not open, and there is no active intake or approved screening process to evaluate people today.",
  },
  {
    question: "Will CUT BLOCK work with young people?",
    answer:
      "Not through this website or the planned adult pilot. Any future youth program would require reviewed safeguarding, guardian-consent, supervision, and operating procedures before it could be considered.",
  },
  {
    question: "Is there a CUT BLOCK gym or training facility?",
    answer:
      "No. A performance, athletics, fitness, or facility-based offering is a future concept only. There are no training sessions, memberships, locations, or facility opening dates to share.",
  },
  {
    question: "Does the AI pathway mean AI makes the decisions?",
    answer:
      "No. The intended focus is learning how to use technology thoughtfully: understand its limits, check its work, protect private information, and use human judgment.",
  },
  {
    question: "Is CUT BLOCK a nonprofit or a registered organization?",
    answer:
      "CUT BLOCK Development is a provisional working brand. This preview makes no claim about legal structure, nonprofit status, tax deductibility, or registration.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return <p className="section-label">{children}</p>;
}

export function App({ presentation = readPresentation(import.meta.env) } = {}) {
  const production = presentation.production;
  const displayedQuestions = questions.map((item) => item.question === "Is CUT BLOCK a nonprofit or a registered organization?" && production
    ? { ...item, answer: "CUT BLOCK makes no claim here about legal structure, nonprofit status, tax deductibility, or registration." }
    : item);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="preview-banner">
        <span className="status-dot" aria-hidden="true" />
        {production ? "CUT BLOCK" : "Development preview"} <span aria-hidden="true">/</span> Enrollment is closed
      </div>

      <header className="site-header">
        <a className="brand-lockup" href="#top" aria-label={`${brand.shortName} home`}>
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="brand-type">
            <strong>{brand.shortName}</strong>
            <span>{brand.productName.replace(`${brand.shortName} `, "").toUpperCase()}</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#story">Our story</a>
          <a href="#pathways">Pathways</a>
          <a href="#approach">How it works</a>
          <a href="#readiness">Readiness</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="header-status" href="#readiness">
          <span className="status-dot" aria-hidden="true" />
          Not accepting participants
        </a>
      </header>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" aria-hidden="true" />
              A development-minded community
            </p>
            <h1 id="hero-title">{production ? brand.shortName : `${brand.meaning}.`}</h1>
            {production && <p className="story-lead">{brand.meaning}</p>}
            <p className="hero-deck">
              {brand.tagline} The first planned pathway pairs practical tech
              projects with adult mentorship—learn by making, ask questions,
              and revise with guidance.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="#approach">
                See our approach <span aria-hidden="true">↘</span>
              </a>
              <a className="text-link" href="#readiness">
                Pilot status <span aria-hidden="true">→</span>
              </a>
            </div>
            <p className="hero-note">
              {production ? "Building toward an adult pilot. No applications or enrollment are open."
                : "A provisional brand and a work in progress. No applications or enrollment are open."}
            </p>
          </div>

          <aside className="hero-art" aria-label="The CUT BLOCK development cycle">
            <div className="art-topline">
              <span>THE DEVELOPMENT CYCLE</span>
              <span>01 — 04</span>
            </div>
            <div className="cycle">
              <div className="cycle-track" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="cycle-step">
                <span className="cycle-index">01</span>
                <span className="cycle-name">Build</span>
                <span className="cycle-caption">Make something real</span>
              </div>
              <div className="cycle-step cycle-step-offset">
                <span className="cycle-index">02</span>
                <span className="cycle-name">Learn</span>
                <span className="cycle-caption">Stay curious</span>
              </div>
              <div className="cycle-step">
                <span className="cycle-index">03</span>
                <span className="cycle-name">Opportunity</span>
                <span className="cycle-caption">Create a next step</span>
              </div>
              <div className="cycle-step cycle-step-offset">
                <span className="cycle-index">04</span>
                <span className="cycle-name">Compete</span>
                <span className="cycle-caption">Bring your best</span>
              </div>
            </div>
            <p className="art-footnote">A point of view, not a promise of outcomes.</p>
            <span className="art-orbit orbit-one" aria-hidden="true" />
            <span className="art-orbit orbit-two" aria-hidden="true" />
          </aside>
        </section>

        <div className="marquee" aria-label="Build with purpose. Learn by doing. Grow together.">
          <span aria-hidden="true">BUILD WITH PURPOSE</span>
          <span aria-hidden="true">✳</span>
          <span aria-hidden="true">LEARN BY DOING</span>
          <span aria-hidden="true">✳</span>
          <span aria-hidden="true">GROW TOGETHER</span>
          <span aria-hidden="true">✳</span>
        </div>

        <section className="story section-wrap" id="story" aria-labelledby="story-title">
          <div className="story-aside">
            <SectionLabel>THE IDEA</SectionLabel>
            <p className="story-aside-note">Come up by doing the work.</p>
            <span className="story-stamp" aria-hidden="true">
              C<br />B
            </span>
          </div>
          <div className="story-copy">
            <h2 id="story-title">
              CUT BLOCK means <span>{brand.meaning}.</span>
            </h2>
            <p className="story-lead">
              Skills develop when people build, test, share, and try again.
              CUT BLOCK is being designed to make that practice meaningful
              and supported.
            </p>
            <p>
              The first planned offering is an adult technology and mentorship
              pilot. Performance and athletics are possible future directions,
              not programs available today. Whatever the path, the aim is to
              give people room to practice deliberately and choose what to try
              next—not promise a job, placement, or specific result.
            </p>
            <p>
              “Competition” is about showing up with commitment and measuring
              your own progress—not a claim that one path, person, or outcome
              wins every time.
            </p>
            <div className="story-signoff">
              <span className="signoff-rule" aria-hidden="true" />
              <span>From the codebase to the field.</span>
            </div>
          </div>
        </section>

        <section className="pathways-section" id="pathways" aria-labelledby="pathways-title">
          <div className="section-wrap">
            <div className="section-heading">
              <div>
                <SectionLabel>ROOM TO GROW</SectionLabel>
                <h2 id="pathways-title">Different paths.<br />One way forward.</h2>
              </div>
              <p>
                The roadmap spans learning, people, and performance. The paths
                below describe direction—not active services or open spots.
              </p>
            </div>
            <div className="pathway-grid">
              {pathways.map((pathway) => (
                <article className={`pathway-card ${pathway.tone}`} key={pathway.number}>
                  <div className="card-topline">
                    <span>{pathway.category}</span>
                    <span className="card-number">{pathway.number}</span>
                  </div>
                  <div className="pathway-symbol" aria-hidden="true">
                    {pathway.number === "01" ? "⌘" : pathway.number === "02" ? "↗" : "◎"}
                  </div>
                  <h3>{pathway.title}</h3>
                  <p>{pathway.description}</p>
                  <span className="pathway-status">
                    <span className="status-dot" aria-hidden="true" />
                    {pathway.status}
                  </span>
                </article>
              ))}
            </div>
            <p className="pathways-note">
              Performance, athletics, fitness, and any future Development
              Center are in the planning horizon only. There is no facility or
              physical training program today.
            </p>
          </div>
        </section>

        <section className="approach section-wrap" id="approach" aria-labelledby="approach-title">
          <div className="approach-intro">
            <SectionLabel>HOW WE THINK ABOUT PRACTICE</SectionLabel>
            <h2 id="approach-title">Practice is the point.</h2>
            <p>
              A good session should leave a learner with something they tried,
              feedback they can use, and one next challenge. This is a
              future-program design principle—not a service currently underway.
            </p>
            <a className="text-link" href="#readiness">
              What readiness means <span aria-hidden="true">→</span>
            </a>
          </div>
          <ol className="practice-list">
            {practiceSteps.map((step) => (
              <li key={step.number}>
                <span className="practice-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                <span className="practice-arrow" aria-hidden="true">↗</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="readiness-section" id="readiness" aria-labelledby="readiness-title">
          <div className="readiness-wrap">
            <div className="readiness-main">
              <SectionLabel>WHERE THINGS STAND</SectionLabel>
              <p className="readiness-kicker">
                <span className="status-dot" aria-hidden="true" />
                Adult pilot planned · not open
              </p>
              <h2 id="readiness-title">Built carefully.<br />Not open just yet.</h2>
              <p className="readiness-lead">
                The first concept is an adult technology and mentorship pilot.
                Enrollment is not open, applications are not being collected,
                and no mentor matching is underway.
              </p>
              <p>
                A responsible start takes more than a good idea. Before an
                adult program could begin, its operating model, eligibility,
                consent, mentor screening, privacy, and review responsibilities
                would need to be ready and approved.
              </p>
            </div>
            <div className="readiness-checklist" aria-label="Readiness boundaries">
              <h3>Clear boundaries matter.</h3>
              <ul>
                <li><span aria-hidden="true">—</span><span>Adult-focused first concept; not accepting participants.</span></li>
                <li><span aria-hidden="true">—</span><span>No mentor interest forms, applications, or contact collection.</span></li>
                <li><span aria-hidden="true">—</span><span>No youth participation before safeguarding and guardian processes are reviewed.</span></li>
                <li><span aria-hidden="true">—</span><span>No active athletics, fitness, facility, or training service.</span></li>
              </ul>
              <p>This {production ? "website" : "preview"} is information only—not an invitation to apply.</p>
            </div>
          </div>
        </section>

        <section className="faq section-wrap" id="faq" aria-labelledby="faq-title">
          <div className="faq-heading">
            <SectionLabel>GOOD QUESTIONS</SectionLabel>
            <h2 id="faq-title">Before you ask.</h2>
            <p>Plain answers about what this {production ? "website" : "preview"} is—and what it is not.</p>
          </div>
          <div className="faq-list">
            {displayedQuestions.map(({ question, answer }, index) => (
              <details className="faq-item" key={question}>
                <summary>
                  <span className="faq-index">0{index + 1}</span>
                  <span>{question}</span>
                  <span className="faq-toggle" aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <a className="brand-lockup footer-brand" href="#top" aria-label={`${brand.shortName} home`}>
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            <span className="brand-type">
              <strong>{brand.shortName}</strong>
              <span>{brand.productName.replace(`${brand.shortName} `, "").toUpperCase()}</span>
            </span>
          </a>
          <p>Build with purpose. Learn by doing. Grow together.</p>
          {production && <p>Business line: <a href="tel:+12816927522">281-692-7522</a></p>}
          <a className="footer-top" href="#top">Back to top ↑</a>
        </div>
        <div className="footer-bottom">
          <span>{production ? brand.productName : `Development preview · ${brand.status} working brand`}</span>
          <span>No enrollment, applications, or services are open.</span>
        </div>
      </footer>
    </>
  );
}
