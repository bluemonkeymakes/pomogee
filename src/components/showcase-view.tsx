import { shapeForVariant, insetPath, scaleForTime, MAX_SHAPE_INDEX, type InsetKind } from "@/lib/shapes";
import type { SessionMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIEW = 400;
const RADIUS = 160;
const CELL_SIZE = 56;

const MODES: SessionMode[] = ["continuous", "break", "gap"];

// Synthetic timestamps at each time-of-day bucket for scale demonstrations
const TIME_BUCKETS: ReadonlyArray<{ label: string; hour: number; scale: number }> = [
  { label: "morning · 5–12",  hour: 8,  scale: scaleForTime(new Date().setHours(8,  0, 0, 0)) },
  { label: "midday · 12–17",  hour: 14, scale: scaleForTime(new Date().setHours(14, 0, 0, 0)) },
  { label: "evening · 17–22", hour: 19, scale: scaleForTime(new Date().setHours(19, 0, 0, 0)) },
  { label: "night · 22–5",    hour: 23, scale: scaleForTime(new Date().setHours(23, 0, 0, 0)) },
];

const INSET_KINDS: ReadonlyArray<{ kind: InsetKind; bucket: string }> = [
  { kind: "dot",      bucket: "morning · 5–12"  },
  { kind: "triangle", bucket: "midday · 12–17"  },
  { kind: "star",     bucket: "evening · 17–22" },
  { kind: "ring",     bucket: "night · 22–5"    },
];

// ── Shared cell ────────────────────────────────────────────────────────────

interface CellProps {
  d: string;
  insetD?: string;
  label: string;
  sublabel?: string;
  title?: string;
  size?: number;
}

function Cell({ d, insetD, label, sublabel, title, size = CELL_SIZE }: CellProps) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={title}>
      <svg
        viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
        width={size}
        height={size}
        className="select-none rounded-md border bg-card"
        aria-hidden
      >
        <circle cx={0} cy={0} r={RADIUS + 12} fill="none"
          className="stroke-border" strokeWidth={0.5} strokeDasharray="2 4" />
        <path
          d={d}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-foreground"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity={0.85}
        />
        {insetD && (
          <path
            d={insetD}
            vectorEffect="non-scaling-stroke"
            className="fill-none stroke-foreground"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={0.6}
          />
        )}
      </svg>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{label}</span>
      {sublabel && (
        <span className="text-[9px] text-muted-foreground/60">{sublabel}</span>
      )}
    </div>
  );
}

// ── Rules legend ───────────────────────────────────────────────────────────

function RulesLegend() {
  const rules = [
    {
      trigger: "session.mode",
      effect: "shape family",
      detail: "break → circle · gap → n-gon · continuous p0–1 → n-gon · continuous p2+ → star {n/k}",
    },
    {
      trigger: "position (0–19)",
      effect: "shape complexity",
      detail: "increments sides / star preset per session within the day",
    },
    {
      trigger: "day-of-year × 7 mod 3",
      effect: "variant (0–2)",
      detail: "0: default rotation · 1: rotated half-step · 2: scale 0.88×",
    },
    {
      trigger: "startedAt hour",
      effect: "radius scale",
      detail: "morning 0.55 · midday 0.72 · evening 0.88 · night 1.0",
    },
    {
      trigger: "startedAt hour (top layer only)",
      effect: "center inset",
      detail: "dot · triangle · star · ring",
    },
  ];

  return (
    <section className="space-y-2">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Rules</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-1.5 pr-6 font-normal uppercase tracking-wider">Trigger</th>
              <th className="pb-1.5 pr-6 font-normal uppercase tracking-wider">Effect</th>
              <th className="pb-1.5 font-normal uppercase tracking-wider">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r) => (
              <tr key={r.trigger}>
                <td className="py-1.5 pr-6 font-mono text-accent-foreground">{r.trigger}</td>
                <td className="py-1.5 pr-6 text-muted-foreground">{r.effect}</td>
                <td className="py-1.5 text-muted-foreground">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Mode × variant grid ────────────────────────────────────────────────────

function describeVariant(variant: number): string {
  if (variant === 1) return "rotated half-step";
  if (variant === 2) return "scale 0.88×";
  return "default rotation";
}

function ModeBlock({ mode }: { mode: SessionMode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">{mode}</h3>
      <div className="space-y-2">
        {[0, 1, 2].map((variant) => (
          <div key={variant} className="flex items-start gap-3">
            <div className="w-28 shrink-0 pt-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                variant {variant}
              </div>
              <div className="text-[9px] text-muted-foreground/60">{describeVariant(variant)}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: MAX_SHAPE_INDEX + 1 }, (_, position) => {
                const { d, name } = shapeForVariant(position, mode, RADIUS, variant);
                return <Cell key={position} d={d} label={`p${position}`} title={name} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Time-of-day scale ──────────────────────────────────────────────────────

function TimeScaleBlock() {
  // Show position 2, continuous, variant 0 at each time bucket to isolate the scale effect
  const refMode: SessionMode = "continuous";
  const refVariant = 0;
  const refPosition = 2;

  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Time-of-day scale</h3>
      <p className="text-xs text-muted-foreground">
        Applied to <span className="font-mono">R</span> before shape generation.
        Same shape (p2 continuous v0) at each bucket — dashed guide ring shows full R for reference.
      </p>
      <div className="flex flex-wrap gap-4">
        {TIME_BUCKETS.map(({ label, scale }) => {
          const scaledR = RADIUS * scale;
          const { d } = shapeForVariant(refPosition, refMode, scaledR, refVariant);
          return (
            <Cell
              key={label}
              d={d}
              label={`${scale.toFixed(2)}×`}
              sublabel={label}
              title={label}
              size={80}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Variant scale (0.88×) and time scale compose — e.g. morning + variant 2 → 0.55 × 0.88 = 0.48× R.
      </p>
    </section>
  );
}

// ── Insets (top layer only) ────────────────────────────────────────────────

function InsetsBlock() {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Center insets</h3>
      <p className="text-xs text-muted-foreground">
        Drawn at <span className="font-mono">r = R × 0.12</span> on the topmost layer only.
        Encodes clock-time of that session.
      </p>
      <div className="flex flex-wrap gap-4">
        {INSET_KINDS.map(({ kind, bucket }) => (
          <Cell
            key={kind}
            d={insetPath(kind, RADIUS)}
            label={kind}
            sublabel={bucket}
            size={72}
          />
        ))}
      </div>
    </section>
  );
}

// ── Stacked examples ───────────────────────────────────────────────────────

function CombinedBlock() {
  type LayerSpec = { mode: SessionMode; variant: number; scale: number; inset?: InsetKind };

  const examples: Array<{ title: string; annotation: string; layers: LayerSpec[] }> = [
    {
      title: "morning flow",
      annotation: "4 continuous · variant 0 · scale 0.55×",
      layers: [
        { mode: "continuous", variant: 0, scale: 0.55, inset: "dot" },
        { mode: "continuous", variant: 0, scale: 0.55 },
        { mode: "continuous", variant: 0, scale: 0.55 },
        { mode: "continuous", variant: 0, scale: 0.55 },
      ],
    },
    {
      title: "mixed day · variant 1",
      annotation: "morning → midday → evening, mode varies",
      layers: [
        { mode: "continuous", variant: 1, scale: 0.55 },
        { mode: "break",      variant: 1, scale: 0.72 },
        { mode: "continuous", variant: 1, scale: 0.72 },
        { mode: "gap",        variant: 1, scale: 0.88 },
        { mode: "continuous", variant: 1, scale: 0.88, inset: "star" },
      ],
    },
    {
      title: "late night · variant 2",
      annotation: "gap + break + continuous · scale 1.0×",
      layers: [
        { mode: "gap",        variant: 2, scale: 1.0 },
        { mode: "continuous", variant: 2, scale: 1.0 },
        { mode: "break",      variant: 2, scale: 1.0 },
        { mode: "gap",        variant: 2, scale: 1.0 },
        { mode: "continuous", variant: 2, scale: 1.0, inset: "ring" },
      ],
    },
  ];

  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Stacked examples</h3>
      <div className="flex flex-wrap gap-8">
        {examples.map((ex) => (
          <div key={ex.title} className="flex flex-col items-center gap-2">
            <svg
              viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
              width={200}
              height={200}
              className="select-none rounded-md border bg-card"
              aria-hidden
            >
              <circle cx={0} cy={0} r={RADIUS + 12} fill="none"
                className="stroke-border" strokeWidth={0.5} strokeDasharray="2 4" />
              {ex.layers.map((layer, i) => {
                const scaledR = RADIUS * layer.scale;
                const { d } = shapeForVariant(i, layer.mode, scaledR, layer.variant);
                return (
                  <g key={i}>
                    <path
                      d={d}
                      vectorEffect="non-scaling-stroke"
                      className="fill-none stroke-foreground"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeOpacity={0.85}
                    />
                    {layer.inset && (
                      <path
                        d={insetPath(layer.inset, scaledR)}
                        vectorEffect="non-scaling-stroke"
                        className="fill-none stroke-foreground"
                        strokeWidth={1.2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeOpacity={0.6}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="text-center">
              <div className="text-xs font-medium">{ex.title}</div>
              <div className="text-[10px] text-muted-foreground">{ex.annotation}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export function ShowcaseView({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-10", className)}>
      <header className="space-y-1">
        <h2 className="font-serif text-2xl">Shape showcase</h2>
        <p className="text-sm text-muted-foreground">
          All <span className="font-mono">(position, mode, variant)</span> combinations with
          annotated rules. Dev-only — hidden in production builds.
        </p>
      </header>
      <RulesLegend />
      {MODES.map((mode) => <ModeBlock key={mode} mode={mode} />)}
      <TimeScaleBlock />
      <InsetsBlock />
      <CombinedBlock />
    </div>
  );
}
