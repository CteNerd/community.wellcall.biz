import { brand } from "./branding.ts";
import "./style.css";

export function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header>
        <p className="wordmark">{brand.name}</p>
        <nav aria-label="Main navigation"><a href="#mission">Mission</a><a href="#programs">Program roadmap</a></nav>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="headline">
          <p className="eyebrow">Development preview / provisional brand</p>
          <h1 id="headline">Build your skills. Earn your next opportunity.</h1>
          <p className="lead">{brand.tagline}</p>
          <p>Grow through deliberate practice, candid mentorship and the right tools for the challenge.</p>
          <a className="button" href="#programs">Explore the roadmap</a>
        </section>
        <section id="mission" aria-labelledby="mission-title">
          <h2 id="mission-title">Practice with purpose.</h2>
          <p>Our first planned pilot focuses on adult technology and mentorship. Enrollment is not open in this preview.</p>
        </section>
        <section id="programs" aria-labelledby="programs-title">
          <h2 id="programs-title">One mission. Multiple paths.</h2>
          <div className="cards">
            <article><span>Planned adult pilot</span><h3>Technology &amp; AI</h3><p>Guided projects, sound judgment and opportunities to apply new skills.</p></article>
            <article><span>Planned adult pilot</span><h3>Mentorship</h3><p>Approved mentors, clear goals and accountable, assigned relationships.</p></article>
            <article><span>Future programs</span><h3>Athletics &amp; fitness</h3><p>Athletic training, fitness and future facility-based activities, subject to operational readiness.</p></article>
          </div>
          <p>Youth participation will not be enabled before safety and guardian-consent requirements are in place.</p>
        </section>
      </main>
      <footer>Development preview. No enrollment, payments or legal status claims.</footer>
    </>
  );
}
