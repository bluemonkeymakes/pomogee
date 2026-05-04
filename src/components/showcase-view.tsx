import { shapeForVariant, insetPath, MAX_SHAPE_INDEX, type InsetKind } from "@/lib/shapes";
import type { SessionMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIEW = 400;
const RADIUS = 160;
const CELL_SIZE = 56;

const MODES: SessionMode[] = ["continuous", "break", "gap"];
const INSET_KINDS: ReadonlyArray<{ kind: InsetKind; bucket: string }> = [
  { kind: "dot", bucket: "morning · 5–12" },
  { kind: "triangle", bucket: "midday · 12–17" },
  { kind: "star", bucket: "evening · 17–22" },
  { kind: "ring", bucket: "night · 22–5" },
];

interface CellProps {
  d: string;
  insetD?: string;
  label: string;
  title?: string;
}

function Cell({ d, insetD, label, title }: CellProps) {
  return (
    <div className="flex flex-col items-center gap-1" title={title}>
      <svg
        viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
        width={CELL_SIZE}
        height={CELL_SIZE}
        className="select-none rounded-md border bg-card"
        aria-hidden
      >
        <path
          d={d}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-foreground"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity={0.85}
        />
        {insetD ? (
          <path
            d={insetD}
            vectorEffect="non-scaling-stroke"
            className="fill-none stroke-foreground"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeOpacity={0.65}
          />
        ) : null}
      </svg>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{label}</span>
    </div>
  );
}

function ModeBlock({ mode }: { mode: SessionMode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">{mode}</h3>
      <div className="space-y-2">
        {[0, 1, 2].map((variant) => (
          <div key={variant} className="flex items-center gap-3">
            <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              variant {variant}
            </span>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: MAX_SHAPE_INDEX + 1 }, (_, position) => {
                const { d, name } = shapeForVariant(position, mode, RADIUS, variant);
                return <Cell key={position} d={d} label={`p${position}`} title={name} />;
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{describeMode(mode)}</p>
    </section>
  );
}

function describeMode(mode: SessionMode): string {
  if (mode === "continuous") return "Variant 0: plain n-gon. Variant 1: nested polygon. Variant 2: + inscribed circle.";
  if (mode === "break") return "Variant 0: plain rings. Variant 1: + center dot. Variant 2: + inscribed diamond.";
  return "Variant 0: plain star. Variant 1: + halo circle at half-radius. Variant 2: + nested smaller star.";
}

function InsetsBlock() {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Time-of-day insets</h3>
      <div className="flex flex-wrap gap-4">
        {INSET_KINDS.map(({ kind, bucket }) => (
          <div key={kind} className="flex flex-col items-center gap-1">
            <Cell d={insetPath(kind, RADIUS)} label={kind} />
            <span className="text-[10px] text-muted-foreground">{bucket}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Drawn at the layer's center at ~12% of the layer radius. Calendar suppresses these for legibility.
      </p>
    </section>
  );
}

function CombinedBlock() {
  // A few illustrative stacks: each entry is a list of (position, mode, variant, inset).
  const examples: Array<{ title: string; layers: Array<{ mode: SessionMode; variant: number; inset: InsetKind }> }> = [
    {
      title: "morning flow (4 continuous)",
      layers: [
        { mode: "continuous", variant: 0, inset: "dot" },
        { mode: "continuous", variant: 0, inset: "dot" },
        { mode: "continuous", variant: 0, inset: "dot" },
        { mode: "continuous", variant: 0, inset: "dot" },
      ],
    },
    {
      title: "split day · variant 1",
      layers: [
        { mode: "continuous", variant: 1, inset: "dot" },
        { mode: "break", variant: 1, inset: "dot" },
        { mode: "continuous", variant: 1, inset: "triangle" },
        { mode: "gap", variant: 1, inset: "star" },
        { mode: "continuous", variant: 1, inset: "star" },
      ],
    },
    {
      title: "fragmented · variant 2",
      layers: [
        { mode: "continuous", variant: 2, inset: "dot" },
        { mode: "gap", variant: 2, inset: "triangle" },
        { mode: "break", variant: 2, inset: "triangle" },
        { mode: "gap", variant: 2, inset: "star" },
        { mode: "break", variant: 2, inset: "star" },
        { mode: "continuous", variant: 2, inset: "ring" },
      ],
    },
  ];
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Stacked examples</h3>
      <div className="flex flex-wrap gap-6">
        {examples.map((ex) => (
          <div key={ex.title} className="flex flex-col items-center gap-2">
            <svg
              viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
              width={420}
              height={420}
              className="select-none rounded-md border bg-card"
              aria-hidden
            >
              {ex.layers.map((layer, i) => {
                const { d } = shapeForVariant(i, layer.mode, RADIUS, layer.variant);
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
                    <path
                      d={insetPath(layer.inset, RADIUS)}
                      vectorEffect="non-scaling-stroke"
                      className="fill-none stroke-foreground"
                      strokeWidth={1.2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeOpacity={0.6}
                    />
                  </g>
                );
              })}
            </svg>
            <span className="text-xs text-muted-foreground">{ex.title}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShowcaseView({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8", className)}>
      <header className="space-y-1">
        <h2 className="font-serif text-2xl">Shape showcase</h2>
        <p className="text-sm text-muted-foreground">
          All <span className="font-mono">(position, mode, variant)</span> combinations and inset motifs.
          Position runs left-to-right, simple to complex.
        </p>
      </header>
      {MODES.map((mode) => (
        <ModeBlock key={mode} mode={mode} />
      ))}
      <InsetsBlock />
      <CombinedBlock />
    </div>
  );
}
