import { useEffect } from "react";
import { PreviewBanner, scrollToHash, SectionLabel, SiteFooter, SiteHeader, SkipLink, StatusChip } from "./chrome.tsx";
import { readPresentation } from "./presentation.ts";
import { brand } from "./branding.ts";
import "./style.css";

/**
 * Development tracks (what a learner may study, on the Pathways/Experience
 * pages) are intentionally modeled separately from participation roles (how
 * a visitor may someday engage, in the role cards below).
 */
const participationRoles = [
  {
    number: "01",
    category: "For future learners",
    title: "I want to grow.",
    description:
      "Initial focus is adults, not youth. Challenges would start from real goals, build toward a practice artifact, and include constructive feedback and reflection. There is no application to submit yet.",
    anchorId: "learner-journey",
    tone: "citrus",
  },
  {
    number: "02",
    category: "For future mentors",
    title: "I want to give back.",
    description:
      "Future contributors could include software engineers, PMs, QA specialists, cloud professionals, leaders, and coaches with verified qualifications—reviewing a project, helping define a challenge, or giving feedback. Onboarding, screening and matching are not yet operational.",
    anchorId: "mentor-journey",
    tone: "sky",
  },
];

const practiceSteps = [
  {
    number: "01",
    title: "Discover",
    description: "Identify goals and a starting skill before choosing a first project.",
  },
  {
    number: "02",
    title: "Choose",
    description: "Pick a skill or project from the office or field pathways.",
  },
  {
    number: "03",
    title: "Work",
    description: "Work with a qualified mentor—after readiness and screening are approved.",
  },
  {
    number: "04",
    title: "Show",
    description: "Show the work and receive specific, constructive feedback.",
  },
  {
    number: "05",
    title: "Reflect",
    description: "Reflect on progress and choose a next challenge; no particular outcome is promised.",
  },
];

const questions = [
  {
    question: "Can I apply, enroll, or book a mentor now?",
    answer:
      "No. Public enrollment and mentor applications are closed. This website explains the direction of the work; it does not collect applications, reserve a place, or create a mentor relationship.",
  },
  {
    question: "What's the difference between a pathway and a role?",
    answer:
      "A pathway (office or field) is what you could study. A role (learner or mentor) is how you might someday take part. The two are independent: a role doesn't imply a specific pathway, and a pathway doesn't imply a role is open today.",
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
    question: "Is there a CUT BLOCK gym, league, or training facility?",
    answer:
      "No. On-field training is a future direction only. There are no training sessions, memberships, locations, leagues, or facility opening dates to share.",
  },
  {
    question: "Does the AI pathway mean AI makes the decisions?",
    answer:
      "No. The intended focus is learning how to use technology thoughtfully: understand its limits, check its work, protect private information, and use human judgment.",
  },
  {
    question: "Is The Lab part of CUT BLOCK?",
    answer:
      "No. The Lab Performance & Strength is a separate business owned by Pat Robertson, a former Murray State football teammate of the founder. Any future collaboration is under discussion, clearly labeled as such, and is not a formal partnership, shared program, or endorsement today.",
  },
  {
    question: "Is CUT BLOCK a nonprofit or a registered organization?",
    answer:
      "CUT BLOCK Development is a provisional working brand. This preview makes no claim about legal structure, nonprofit status, tax deductibility, or registration.",
  },
];

/**
 * "Experience" moved from a same-page section to its own page; keep the old
 * #approach bookmark working by redirecting instead of scrolling. Exported
 * so the mapping itself is directly testable without mocking navigation.
 */
export function legacyHashRedirectTarget(hash: string): string | null {
  return hash === "#approach" ? "/experience" : null;
}

export function App({ presentation = readPresentation(import.meta.env) } = {}) {
  const production = presentation.production;
  const displayedQuestions = questions.map((item) => item.question === "Is CUT BLOCK a nonprofit or a registered organization?" && production
    ? { ...item, answer: "CUT BLOCK makes no claim here about legal structure, nonprofit status, tax deductibility, or registration." }
    : item);

  useEffect(() => {
    const target = legacyHashRedirectTarget(window.location.hash);
    if (target) window.location.replace(target);
    // The index document has no pre-rendered sections for the browser to
    // jump to, so native "#id" scrolling on load is unreliable; do it here.
    else scrollToHash(window.location.hash);
  }, []);

  return (
    <>
      <SkipLink />
      <PreviewBanner production={production} />
      <SiteHeader page="home" />

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" aria-hidden="true" />
              A development-minded community
            </p>
            <h1 id="hero-title">Potential shouldn't depend on who you know.</h1>
            <p className="hero-brand-meaning">{brand.meaning}</p>
            <p className="hero-deck">
              We're building pathways for tomorrow's professionals—through
              practical technology work and mentorship in the office, and an
              eventual on-field development network rooted in the trenches.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="/pathways">
                Explore development pathways <span aria-hidden="true">↘</span>
              </a>
              <a className="text-link" href="#participate">
                How the pilot may work <span aria-hidden="true">→</span>
              </a>
            </div>
            <p className="hero-status">
              <span className="status-dot" aria-hidden="true" />
              Current status: adult technology pilot planned · applications
              closed · field training not open.
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

        <section className="story section-wrap" id="mission" aria-labelledby="mission-title">
          <span id="story" className="legacy-anchor" aria-hidden="true" />
          <div className="story-aside">
            <SectionLabel>THE MISSION</SectionLabel>
            <p className="story-aside-note">Come up by doing the work.</p>
            <span className="story-stamp" aria-hidden="true">
              C<br />B
            </span>
          </div>
          <div className="story-copy">
            <h2 id="mission-title">
              CUT BLOCK means <span>{brand.meaning}.</span>
            </h2>
            <p className="story-lead">
              CUT BLOCK comes from a career spent in two trenches: the
              offensive line and the engineering team. Both taught the same
              lesson—skill is built through access, repetition, and people
              willing to coach you through the hard reps.
            </p>
            <p>
              The near-term focus is a planned adult technology and
              mentorship pilot. The fuller office-and-field vision below is a
              growth roadmap, not an active program—CUT BLOCK only grows into
              new ground after it can run the first rep well.
            </p>
            <p>
              "Competition" here means showing up with commitment and
              measuring your own progress—not a claim that one path, person,
              or outcome wins every time.
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
                <SectionLabel>DEVELOPMENT TRACKS</SectionLabel>
                <h2 id="pathways-title">Explore the development pathways.</h2>
              </div>
              <p>
                These are subjects you could study—not a signup form. How you
                might take part, as a learner or a mentor, is a separate
                question answered in Participate below.
              </p>
            </div>
            <div className="pathway-teaser-grid">
              <article className="pathway-teaser">
                <StatusChip tone="planned">Planned adult pilot</StatusChip>
                <h3>In the office</h3>
                <p>
                  Project management, full-stack engineering, QA,
                  cloud/DevOps, leadership and more—organized into a
                  six-group capability map.
                </p>
                <a className="text-link" href="/pathways#office">
                  See the full office pathway <span aria-hidden="true">→</span>
                </a>
              </article>
              <article className="pathway-teaser">
                <StatusChip tone="future">Future pathway</StatusChip>
                <h3>On the field</h3>
                <p>
                  Built in the trenches: a future offensive and defensive
                  line development vision, with room for additional
                  positions over time.
                </p>
                <a className="text-link" href="/pathways#field">
                  See the full field pathway <span aria-hidden="true">→</span>
                </a>
              </article>
            </div>
            <p className="pathways-note">
              Want concrete examples of what this could look like?{" "}
              <a className="text-link" href="/experience">Explore example learning experiences <span aria-hidden="true">→</span></a>
            </p>
          </div>
        </section>

        <section className="approach section-wrap" id="participate" aria-labelledby="participate-title">
          <div className="approach-intro">
            <SectionLabel>LEARNERS AND MENTORS</SectionLabel>
            <h2 id="participate-title">Two ways to take part later.</h2>
            <p>
              These participation roles describe the proposed adult
              pilot—not active services, applications, or open spots.
            </p>
          </div>
          <div className="pathway-grid">
            {participationRoles.map((role) => (
              <article className={`pathway-card journey-card ${role.tone}`} key={role.number} id={role.anchorId}>
                <div className="card-topline">
                  <span>{role.category}</span>
                  <span className="card-number">{role.number}</span>
                </div>
                <div className="pathway-symbol" aria-hidden="true">
                  {role.number === "01" ? "↗" : "○"}
                </div>
                <h3>{role.title}</h3>
                <p>{role.description}</p>
              </article>
            ))}
          </div>
          <div className="experience-heading">
            <SectionLabel>DISCOVER · CHOOSE · WORK · SHOW · REFLECT</SectionLabel>
            <h3>A proposed participant experience.</h3>
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
          <p className="progress-evidence">
            Progress evidence may eventually look like a portfolio artifact,
            a test suite, a deployment, a project plan, a retrospective, a
            coach-approved film review, or mentor feedback. CUT BLOCK does
            not promise internships, jobs, scholarships, roster spots,
            college recruitment or professional contracts.
          </p>
        </section>

        <section className="ecosystem-section section-wrap" id="ecosystem" aria-labelledby="ecosystem-title">
          <SectionLabel>WHERE OPPORTUNITY COMES FROM</SectionLabel>
          <h2 id="ecosystem-title">Potential collaborators.</h2>
          <p>
            We're designing a network of mentors, coaches and business
            partners who can make professional and athletic development
            real. Practitioners, businesses and coaches could eventually
            contribute through project reviews, mentoring, or coaching—once
            CUT BLOCK's own readiness and screening are in place.
          </p>
          <article className="collaborator-card">
            <p className="collaborator-status">Potential collaboration — under discussion</p>
            <h3>The Lab Performance &amp; Strength</h3>
            <p>
              Pat Robertson, a former Murray State football teammate of the
              founder, owns The Lab Performance &amp; Strength, a separate
              business. Aligning CUT BLOCK's future on-field vision with
              experts in athletic development is under discussion. The Lab is
              not an official CUT BLOCK partner today, CUT BLOCK does not
              train participants there, and this is not a formal training
              partnership.
            </p>
          </article>
          <p className="ecosystem-footnote">
            The founder's other ventures (Third Down Technologies' client
            work, Sugar Society, R3 Counseling, and the Candy Map project)
            illustrate lived experience building businesses. They are not
            CUT BLOCK cohort accomplishments, paid placements, active mentor
            assignments, or current sponsor arrangements.
          </p>
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
                The first concept is an adult technology and mentorship
                pilot. Enrollment is not open, applications are not being
                collected, and no mentor matching is underway.
              </p>
              <p>
                A responsible start takes more than a good idea. Before an
                adult program could begin, its operating model, eligibility,
                consent, mentor screening, privacy, and review
                responsibilities would need to be ready and approved.
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

      <SiteFooter page="home" production={production} />
    </>
  );
}
