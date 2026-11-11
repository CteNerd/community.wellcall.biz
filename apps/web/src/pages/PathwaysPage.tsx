import { useEffect } from "react";
import { PreviewBanner, scrollToHash, SectionLabel, SiteFooter, SiteHeader, SkipLink, StatusChip } from "../chrome.tsx";
import { readPresentation } from "../presentation.ts";
import "../style.css";

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

export function PathwaysPage({ presentation = readPresentation(import.meta.env) } = {}) {
  const production = presentation.production;

  useEffect(() => { scrollToHash(window.location.hash); }, []);

  return (
    <>
      <SkipLink />
      <PreviewBanner production={production} />
      <SiteHeader page="pathways" />

      <main id="main">
        <section className="pathways-section" aria-labelledby="pathways-page-title">
          <div className="section-wrap">
            <div className="section-heading page-heading">
              <div>
                <SectionLabel>DEVELOPMENT TRACKS</SectionLabel>
                <h1 id="pathways-page-title">Explore the development pathways.</h1>
              </div>
              <p>
                These are subjects you could study—not a signup form. How you
                might take part, as a learner or a mentor, is answered on{" "}
                <a className="text-link" href="/#participate">Participate</a>.
                Concrete practice examples live on the{" "}
                <a className="text-link" href="/experience">Experience</a> page.
              </p>
            </div>

            <div className="track-group" id="office">
              <div className="track-header">
                <StatusChip tone="planned">Planned adult pilot</StatusChip>
                <h2>In the office</h2>
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
                    <h3>{item.group}</h3>
                    <p className="capability-skills">{item.skills}</p>
                    <p className="capability-example">{item.example}</p>
                  </article>
                ))}
              </div>
              <img
                className="track-illustration"
                src="/assets/cut-block-office-pathway-51c42a697bf0.jpg"
                alt="Illustrative cartoon artwork of a group of adults collaborating on technology work; not a photo of real participants."
                loading="lazy"
                width={640}
                height={640}
              />
            </div>

            <div className="track-group" id="field">
              <div className="track-header">
                <StatusChip tone="future">Future pathway</StatusChip>
                <h2>On the field</h2>
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
                    <h3>{item.focus}</h3>
                    <p>{item.topics}</p>
                  </article>
                ))}
              </div>
              <img
                className="track-illustration"
                src="/assets/cut-block-field-pathway-8a50c3597ea8.jpg"
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
      </main>

      <SiteFooter page="pathways" production={production} />
    </>
  );
}
