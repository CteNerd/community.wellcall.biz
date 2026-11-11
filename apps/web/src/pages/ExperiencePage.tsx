import { PreviewBanner, SectionLabel, SiteFooter, SiteHeader, SkipLink } from "../chrome.tsx";
import { readPresentation } from "../presentation.ts";
import "../style.css";

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

export function ExperiencePage({ presentation = readPresentation(import.meta.env) } = {}) {
  const production = presentation.production;
  return (
    <>
      <SkipLink />
      <PreviewBanner production={production} />
      <SiteHeader page="experience" />

      <main id="main">
        <section className="experience-section section-wrap" aria-labelledby="experience-page-title">
          <div className="section-heading page-heading">
            <div>
              <SectionLabel>EXAMPLES OF PLANNED EXPERIENCES</SectionLabel>
              <h1 id="experience-page-title">What learners could actually do.</h1>
            </div>
            <p>
              Illustrative examples of projects, deliverables and training
              activities—not results already delivered to past participants.
              These examples draw from the{" "}
              <a className="text-link" href="/pathways">office and field pathways</a>.
            </p>
          </div>
          <div className="example-grid">
            {experienceExamples.map((example) => (
              <article className="example-card" key={example.title}>
                <p className="example-track">{example.track}</p>
                <h2>{example.title}</h2>
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
      </main>

      <SiteFooter page="experience" production={production} />
    </>
  );
}
