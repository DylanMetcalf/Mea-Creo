import { IndexRing } from "@/components/audits/index-ring";

const STAGES = [
  { n: "01", title: "Found", body: "Google, Maps and AI answers" },
  { n: "02", title: "Understood", body: "A clear offer, proof and structure" },
  { n: "03", title: "Chosen", body: "Enquiries that become conversations" },
];

const BARS = [
  ["Search", 72],
  ["AI discoverability", 38],
  ["Conversion", 55],
] as const;

/**
 * The hero's signature visual: the path from being found to being chosen, drawn as a
 * signal line with three nodes, over an example Visibility Report. Decorative motion
 * only runs when the visitor allows motion.
 */
export function HeroVisual() {
  return (
    <figure className="relative">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none absolute -inset-10 -z-10 opacity-90 blur-2xl"
      />
      <div className="bg-night edge-glow shadow-lifted relative isolate overflow-hidden rounded-[28px] p-5 sm:p-7">
        <div aria-hidden className="bg-horizon absolute inset-0 -z-10 opacity-80" />
        <div
          aria-hidden
          className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(80%_70%_at_60%_30%,#000,transparent)]"
        />
        <div className="flex items-center justify-between">
          <p className="label-mono text-night-muted">Visibility → Growth → Intelligence</p>
          <span className="label-mono text-signal flex items-center gap-1.5">
            <span className="bg-signal pulse-node size-1.5 rounded-full" aria-hidden /> Live
          </span>
        </div>

        <svg
          viewBox="0 0 480 280"
          className="mt-2 h-auto w-full"
          role="img"
          aria-label="A signal line rising through three stages: found, understood, chosen."
        >
          <defs>
            <linearGradient id="hv-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#93ceac" stopOpacity="0.4" />
              <stop offset="55%" stopColor="#7fe0b2" />
              <stop offset="100%" stopColor="#e2a05c" />
            </linearGradient>
            <linearGradient id="hv-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7fe0b2" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#7fe0b2" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[70, 140, 210].map((y) => (
            <line key={y} x1="0" x2="480" y1={y} y2={y} stroke="rgb(255 255 255 / 0.07)" />
          ))}
          <path
            d="M 20 260 C 120 250, 140 170, 240 160 S 380 70, 460 40 L 460 280 L 20 280 Z"
            fill="url(#hv-area)"
          />
          <path
            d="M 20 260 C 120 250, 140 170, 240 160 S 380 70, 460 40"
            fill="none"
            stroke="url(#hv-line)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 20 260 C 120 250, 140 170, 240 160 S 380 70, 460 40"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.55"
            strokeWidth="1.2"
            className="flow-dash"
          />
          {[
            [82, 242],
            [240, 160],
            [406, 70],
          ].map(([x, y], i) => (
            <g key={x}>
              <circle
                cx={x}
                cy={y}
                r="13"
                fill="#7fe0b2"
                opacity="0.18"
                className="pulse-node"
                style={{ animationDelay: `${i * 0.6}s` }}
              />
              <circle cx={x} cy={y} r="5.5" fill="#07110d" stroke="#7fe0b2" strokeWidth="2.5" />
            </g>
          ))}
        </svg>

        <ol className="mt-1 grid grid-cols-3 gap-3">
          {STAGES.map((s) => (
            <li key={s.n} className="border-night-line border-t pt-3">
              <span className="label-mono text-signal">{s.n}</span>
              <p className="font-display mt-1 text-[1.05rem] text-white">{s.title}</p>
              <p className="text-night-muted mt-0.5 text-[0.78rem] leading-snug">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="float-slow mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="label-mono text-night-muted">Visibility Report</p>
              <p className="truncate font-medium text-white">yourcompany.co.za</p>
            </div>
            <span className="label-mono rounded-full border border-white/15 px-2 py-0.5 text-white/80">
              Example
            </span>
          </div>
          <div className="mt-4 flex items-center gap-5">
            <IndexRing value={58} size={92} stroke={8} inverse label="Example Visibility Index" />
            <ul className="min-w-0 flex-1 space-y-2.5">
              {BARS.map(([label, v]) => (
                <li key={label}>
                  <div className="text-night-muted flex justify-between text-[0.75rem]">
                    <span>{label}</span>
                    <span className="tabular-nums">{v}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#43835f,#7fe0b2)]"
                      style={{ width: `${v}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Illustration: how Mea Creo moves a business from found, to understood, to chosen, with an
        example Visibility Report.
      </figcaption>
    </figure>
  );
}
