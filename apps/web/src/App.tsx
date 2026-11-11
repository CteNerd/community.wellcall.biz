import { brand } from "./branding.ts";
import { readPresentation } from "./presentation.ts";
import "./style.css";

/**
 * Development tracks (what a learner may study) are intentionally modeled
 * separately from participation roles (how a visitor may someday engage).
 * See the office/field capability maps below and the learner/mentor role
 * cards in the "participate" section.
 */
const officeCapabilityGroups = [
  {
    group: "Plan and deliver",
    skills: "Project management, requirements, agile delivery, stakeholder communication, product thinking",
    example: "Turn a real-world problem into an issue backlog, milestones, acceptance criteria and a delivery review.",
  },
  {
    group: "Engineer and build",
    skills: "Frontend, backend, full-stack software development, API design, AI-assisted engineering, applied AI evaluation",
    example: "Build a small app with a usable UI, an API contract, tests and a demo.",
  },
  {
    group: "Validate quality",
    skills: "QA, exploratory testing, automation, accessibility, SDET / quality engineering",
    example: "Design a test plan, reproduce a bug and add checks that prevent a regression.",
  },
  {
    group: "Operate and scale",
    skills: "Cloud / infrastructure, DevOps, observability, security fundamentals, cost decisions",
    example: "Create a deployment plan, a visibility dashboard or a simple cost/operability review with safe sample data.",
  },
  {
    group: "Lead and grow",
    skills: "Technical leadership, team management, mentoring, presentation, communication and decision-making",
    example: "Lead a project review, explain trade-offs, present progress and give actionable feedback.",
  },
  {
    group: "Explore future disciplines",
    skills: "Robotics, hardware/software integration, more specialized engineering",
    example: "Prototype a sensor/automation scenario using safe available equipment or a simulation—only once qualified mentors and resources exist.",
  },
];

const fieldFocusAreas = [
  {
    focus: "Offensive line",
    topics: "Stance and start, footwork, leverage, hand placement within applicable rules, communication, protection and run-game understanding.",
  },
  {
    focus: "Defensive line",
    topics: "Stance/get-off, leverage, gap responsibilities, hand technique within applicable rules, film study and team communication.",
  },
  {
    focus: "Shared development",
    topics: "Position film review, coach feedback, leadership and accountability, appropriately supervised performance/conditioning.",
  },
  {
    focus: "Additional positions",
    topics: "Future partner-led possibilities, only after relevant expertise, scope and operating safeguards are verified.",
  },
];

const experienceExamples = [
  {
    track: "Office",
    title: "Ship a useful feature",
    skill: "Full-stack engineering",
    artifact: "A small working app: a real user need, a planned backlog, a frontend and API, and a demo.",
    mentorRole: "A future engineer mentor reviews the work and the decisions behind it.",
    growthSignal: "Can explain a design trade-off, not just that the feature works.",
  },
  {
    track: "Office",
    title: "Quality is a profession",
    skill: "QA / SDET",
    artifact: "Turn bug reports into regression tests, accessibility checks and release confidence.",
    mentorRole: "A future quality-engineering mentor reviews the test plan and coverage.",
    growthSignal: "Can describe why a check prevents a specific regression.",
  },
  {
    track: "Office",
    title: "Lead the work",
    skill: "Project management / leadership",
    artifact: "Prioritize a backlog, manage risks, run a stakeholder review and facilitate constructive feedback.",
    mentorRole: "A future leadership mentor reviews how decisions and trade-offs were communicated.",
    growthSignal: "Can run a review that leaves the team clearer on next steps.",
  },
  {
    track: "Office",
    title: "Run it responsibly",
    skill: "Cloud / DevOps",
    artifact: "Deploy a safe demo, observe it, understand its cost, and document who owns it.",
    mentorRole: "A future infrastructure mentor reviews the deployment and operability plan.",
    growthSignal: "Can explain what would page someone at 2 a.m., and why.",
  },
  {
    track: "Field",
    title: "Trenches fundamentals",
    skill: "OL/DL stance, start and leverage",
    artifact: "A filmed drill repetition reviewed for footwork and hand placement.",
    mentorRole: "A future qualified position coach—not active today.",
    growthSignal: "Cleaner footwork and hand placement from one rep to the next.",
  },
  {
    track: "Field",
    title: "Build the film-room habit",
    skill: "Film study and communication",
    artifact: "Break down one play and present the read to a small group.",
    mentorRole: "A future coach-led session—not active today.",
    growthSignal: "Can describe a gap responsibility or protection call clearly.",
  },
];

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
    description: "Pick a skill or project from the office or field pathways above.",
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

function SectionLabel({ children }: { children: string }) {
  return <p className="section-label">{children}</p>;
}

function StatusChip({ tone, children }: { tone: "planned" | "future"; children: string }) {
  return (
    <span className={`status-chip status-chip-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
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
        {production ? "CUT BLOCK" : "Development preview"}
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
          <a href="#mission">Mission</a>
          <a href="#pathways">Pathways</a>
          <a href="#experience">Experience</a>
          <a href="#participate">Participate</a>
          <a href="#ecosystem">Collaborators</a>
          <a href="#readiness">Readiness</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="header-status" href="#readiness">
          Pilot readiness <span aria-hidden="true">↗</span>
        </a>
      </header>

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
              <a className="button button-dark" href="#pathways">
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

            <div className="track-group">
              <div className="track-header">
                <StatusChip tone="planned">Planned adult pilot</StatusChip>
                <h3>In the office</h3>
                <p>
                  The first pilot's planned focus is adult technology
                  learning and mentorship. Project management and QA are
                  first-class options here, not footnotes under "coding"—a
                  learner need not already be a developer.
                </p>
              </div>
              <div className="capability-grid">
                {officeCapabilityGroups.map((item) => (
                  <article className="capability-card" key={item.group}>
                    <h4>{item.group}</h4>
                    <p className="capability-skills">{item.skills}</p>
                    <p className="capability-example">{item.example}</p>
                  </article>
                ))}
              </div>
              <img
                className="track-illustration"
                src="/assets/cut-block-office-pathway-d1d5cdcf5955.png"
                alt="Illustrative cartoon artwork of a group of adults collaborating on technology work; not a photo of real participants."
                loading="lazy"
                width={640}
                height={640}
              />
            </div>

            <div className="track-group">
              <div className="track-header">
                <StatusChip tone="future">Future pathway</StatusChip>
                <h3>On the field</h3>
                <p className="field-headline">Built in the trenches.</p>
                <p>
                  Our field-development vision starts where games are won and
                  lost: the offensive and defensive lines. We aim to connect
                  athletes with qualified coaching, deliberate practice and
                  practical feedback, while creating room for experienced
                  partners to support additional positions over time.
                </p>
              </div>
              <div className="field-grid">
                {fieldFocusAreas.map((item) => (
                  <article className="field-card" key={item.focus}>
                    <h4>{item.focus}</h4>
                    <p>{item.topics}</p>
                  </article>
                ))}
              </div>
              <img
                className="track-illustration"
                src="/assets/cut-block-field-pathway-035af9be119d.png"
                alt="Illustrative cartoon artwork of stylized offensive and defensive linemen in the trenches; not a photo of real athletes or an active program."
                loading="lazy"
                width={640}
                height={640}
              />
              <p className="field-disclaimer">
                No field training program, gym, facility, youth program or
                athlete enrollment is open today.
              </p>
            </div>
          </div>
        </section>

        <section className="experience-section section-wrap" id="experience" aria-labelledby="experience-title">
          <span id="approach" className="legacy-anchor" aria-hidden="true" />
          <div className="section-heading">
            <div>
              <SectionLabel>EXAMPLES OF PLANNED EXPERIENCES</SectionLabel>
              <h2 id="experience-title">What learners could actually do.</h2>
            </div>
            <p>
              Illustrative examples of projects, deliverables and training
              activities—not results already delivered to past participants.
            </p>
          </div>
          <div className="example-grid">
            {experienceExamples.map((example) => (
              <article className="example-card" key={example.title}>
                <p className="example-track">{example.track}</p>
                <h3>{example.title}</h3>
                <dl>
                  <dt>Skill</dt>
                  <dd>{example.skill}</dd>
                  <dt>Practice artifact</dt>
                  <dd>{example.artifact}</dd>
                  <dt>Mentor role</dt>
                  <dd>{example.mentorRole}</dd>
                  <dt>Growth signal</dt>
                  <dd>{example.growthSignal}</dd>
                </dl>
              </article>
            ))}
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

      <footer className="site-footer">
        <div className="footer-main">
          <a className="brand-lockup footer-brand" href="#top" aria-label={`${brand.shortName} home`}>
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            <span className="brand-type">
              <strong>{brand.shortName}</strong>
              <span>{brand.productName.replace(`${brand.shortName} `, "").toUpperCase()}</span>
            </span>
          </a>
          <p>Build with purpose, in the office and on the field.</p>
          {production && <p>Business line: <a href="tel:+12816927522">281-692-7522</a></p>}
          <a className="footer-top" href="#top">Back to top ↑</a>
        </div>
        <div className="footer-bottom">
          <span>{production ? brand.productName : `Development preview · ${brand.status} working brand`}</span>
          <span>Adult pilot planned · Field training not open · Enrollment closed.</span>
        </div>
      </footer>
    </>
  );
}
