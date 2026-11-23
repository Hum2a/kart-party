import { motion } from "motion/react";
import { kartTrackCatalogue } from "@kart-party/game";
import { LinkButton } from "../ui/primitives";
import { TrackPreview } from "../race/TrackPreview";
import { usePrefersReducedMotion } from "../anim/use-reduced-motion";

export function HomePage() {
  const reduced = usePrefersReducedMotion();
  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-10 sm:pt-16">
      <motion.header
        className="grid gap-5"
        initial={{ opacity: 0, y: reduced ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.15 : 0.45, ease: [0.2, 0, 0, 1] }}
      >
        <div className="chequer h-3 w-28 opacity-80" aria-hidden="true" />
        <h1 className="wordmark text-6xl leading-[0.9] sm:text-8xl">
          Kart <span className="text-accent">Party</span>
        </h1>
        <p className="max-w-xl text-lg text-muted sm:text-xl">
          Drift, boost and throw things at your friends. A free kart racer that runs in
          your browser, on your phone or your laptop.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton to="/play" className="min-w-44">
            Race friends
          </LinkButton>
          <LinkButton to="/practice" variant="secondary" className="min-w-44">
            Practise solo
          </LinkButton>
        </div>
      </motion.header>

      <section aria-labelledby="tracks-heading" className="grid gap-4">
        <h2 id="tracks-heading" className="wordmark text-2xl">
          Three tracks
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {kartTrackCatalogue.map((track, i) => (
            <motion.li
              key={track.id}
              className="panel grid gap-2 p-4"
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: reduced ? 0 : 0.08 * i,
                duration: reduced ? 0.12 : 0.35,
              }}
            >
              <TrackPreview
                trackId={track.id}
                className="mx-auto aspect-square w-full max-w-44"
              />
              <h3 className="text-xl font-bold">{track.name}</h3>
              <p className="text-muted">{track.blurb}</p>
            </motion.li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="how-heading"
        className="panel grid gap-4 p-5 sm:grid-cols-3"
      >
        <h2 id="how-heading" className="wordmark text-2xl sm:col-span-3">
          How to drive
        </h2>
        <div>
          <h3 className="font-bold text-highlight">Keyboard</h3>
          <p className="text-muted">
            Arrows or WASD to drive. Space to drift. E for your item. R to get back on
            the track.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-highlight">Phone</h3>
          <p className="text-muted">
            Slide the steering pad, hold Accelerate, and use Drift through the corners.
            Landscape works best.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-highlight">Gamepad</h3>
          <p className="text-muted">
            Left stick steers, A accelerates, B brakes, RB or RT drifts, X uses your
            item and Y puts you back on the track.
          </p>
        </div>
        <p className="text-muted sm:col-span-3">
          Hold a drift to charge it, then let go for a boost. Accelerate right on GO for
          a rocket start.
        </p>
      </section>

      <footer className="text-sm text-muted">
        <p>
          Kart Party is an original game. The tracks, karts and drivers are all drawn in
          code.{" "}
          <a className="underline" href="https://github.com/Hum2a/kart-party">
            Source on GitHub
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
