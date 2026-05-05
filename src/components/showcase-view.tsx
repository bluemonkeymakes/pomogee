import { useMemo } from "react";
import {
  shapeForVariant,
  shapeFromFamily,
  insetPath,
  insetForTime,
  scaleForTime,
  dayVariantIndex,
  MAX_SHAPE_INDEX,
  COMPLEXITY_CAP,
  type ShapeFamily,
  type InsetKind,
} from "@/lib/shapes";
import { useTimer, toYmd } from "@/lib/store";
import type { SessionMode } from "@/lib/types";
import type { GeometryLayer } from "@/components/geometry";
import { cn } from "@/lib/utils";

const VIEW    = 400;
const RADIUS  = 160;
const CELL_SIZE = 56;
const MODES: SessionMode[] = ["continuous", "break", "gap"];

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTs(hour: number, minute = 0): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

// ── Experiment definitions ─────────────────────────────────────────────────

type FamilyFn = (position: number, mode: SessionMode) => ShapeFamily;

interface Experiment {
  id: string;
  label: string;
  note: string;
  familyFor: FamilyFn;
  timeScale: boolean;
}

const EXPERIMENTS: Experiment[] = [
  {
    id: "current",
    label: "current",
    note: "continuous→polygon · break→circle · gap→star",
    familyFor: (_, mode) =>
      mode === "break" ? "circle" : mode === "gap" ? "star" : "polygon",
    timeScale: true,
  },
  {
    id: "break-star",
    label: "break → star",
    note: "deliberate rest earns a star · continuous/gap→polygon",
    familyFor: (_, mode) => (mode === "break" ? "star" : "polygon"),
    timeScale: true,
  },
  {
    id: "streak-star",
    label: "streak reward",
    note: "polygon p0–1 · star p2+ (continuous) · circle for break",
    familyFor: (p, mode) =>
      mode === "break"
        ? "circle"
        : mode === "continuous" && p >= 2
          ? "star"
          : "polygon",
    timeScale: true,
  },
  {
    id: "pos-cycle",
    label: "position cycle",
    note: "polygon → circle → star every 3 positions, ignores mode",
    familyFor: (p) => (["polygon", "circle", "star"] as ShapeFamily[])[p % 3],
    timeScale: true,
  },
  {
    id: "no-time",
    label: "flat radius",
    note: "current family rules · no time-of-day size scaling",
    familyFor: (_, mode) =>
      mode === "break" ? "circle" : mode === "gap" ? "star" : "polygon",
    timeScale: false,
  },
];

// ── Synthetic session groups ───────────────────────────────────────────────

interface Group {
  label: string;
  desc: string;
  layers: GeometryLayer[];
}

const SYNTHETIC_GROUPS: Group[] = [
  {
    label: "morning flow",
    desc: "4 continuous · 8–11am",
    layers: [
      { mode: "continuous", startedAt: makeTs(8) },
      { mode: "continuous", startedAt: makeTs(8, 35) },
      { mode: "break",      startedAt: makeTs(9, 15) },
      { mode: "continuous", startedAt: makeTs(10) },
      { mode: "continuous", startedAt: makeTs(10, 40) },
    ],
  },
  {
    label: "mixed day",
    desc: "continuous + gap + break · 9am–8pm",
    layers: [
      { mode: "continuous", startedAt: makeTs(9) },
      { mode: "break",      startedAt: makeTs(9, 35) },
      { mode: "continuous", startedAt: makeTs(10, 15) },
      { mode: "gap",        startedAt: makeTs(15) },
      { mode: "continuous", startedAt: makeTs(15, 45) },
      { mode: "break",      startedAt: makeTs(20) },
    ],
  },
  {
    label: "late session",
    desc: "gap back-in → flow · 7–11pm",
    layers: [
      { mode: "gap",        startedAt: makeTs(19) },
      { mode: "continuous", startedAt: makeTs(19, 35) },
      { mode: "break",      startedAt: makeTs(20, 15) },
      { mode: "continuous", startedAt: makeTs(21) },
      { mode: "continuous", startedAt: makeTs(21, 35) },
    ],
  },
];

// ── Experiment mandala ─────────────────────────────────────────────────────

/** Mirror of the harmony rule in geometry.tsx: one star per time-zone bucket. */
function resolveExperimentFamilies(
  layers: GeometryLayer[],
  familyFor: FamilyFn,
): ShapeFamily[] {
  const claimed = new Set<number>();
  return layers.map((layer, i) => {
    const family = familyFor(i, layer.mode);
    if (family !== "star") return family;
    const scale = scaleForTime(layer.startedAt);
    if (claimed.has(scale)) return "polygon";
    claimed.add(scale);
    return "star";
  });
}

function ExperimentMandala({
  layers,
  experiment,
  size = 150,
}: {
  layers: GeometryLayer[];
  experiment: Experiment;
  size?: number;
}) {
  const insetIndex = layers.length - 1;
  const families = resolveExperimentFamilies(layers, experiment.familyFor);
  return (
    <svg
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      className="select-none rounded-md border bg-card"
      aria-hidden
    >
      <circle
        cx={0} cy={0} r={RADIUS + 12}
        fill="none" stroke="currentColor"
        className="stroke-border"
        strokeWidth={0.5} strokeDasharray="2 4"
      />
      {layers.map((layer, i) => {
        const family  = families[i];
        const variant = dayVariantIndex(layer.startedAt, 3);
        const scale   = experiment.timeScale ? scaleForTime(layer.startedAt) : 1;
        const { d }   = shapeFromFamily(family, i, RADIUS * scale, variant);
        const isTop   = i === insetIndex;
        return (
          <g key={i}>
            <path
              d={d}
              vectorEffect="non-scaling-stroke"
              fill="none" stroke="currentColor"
              className="stroke-foreground"
              strokeWidth={1.6}
              strokeLinejoin="round" strokeLinecap="round"
              strokeOpacity={0.85}
            />
            {isTop && (
              <path
                d={insetPath(insetForTime(layer.startedAt), RADIUS * scale)}
                vectorEffect="non-scaling-stroke"
                fill="none" stroke="currentColor"
                className="stroke-foreground"
                strokeWidth={1.2}
                strokeLinejoin="round" strokeLinecap="round"
                strokeOpacity={0.5}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Experiments section ────────────────────────────────────────────────────

function ExperimentsSection({ groups }: { groups: Group[] }) {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-serif text-base uppercase tracking-[0.2em]">Experiments</h3>
        <p className="text-xs text-muted-foreground">
          Star-exclusivity rule applied — one star per time-zone bucket. Second gap in same zone renders as polygon.
        </p>
      </div>
      <div className="space-y-8">
        {EXPERIMENTS.map((exp) => (
          <div key={exp.id} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-medium">{exp.label}</span>
              <span className="text-xs text-muted-foreground">{exp.note}</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col items-center gap-1">
                  <ExperimentMandala layers={group.layers} experiment={exp} />
                  <span className="text-[10px] font-medium">{group.label}</span>
                  <span className="text-[9px] text-muted-foreground">{group.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Shape combination tester ──────────────────────────────────────────────

interface ComboSpec {
  label: string;
  families: ShapeFamily[];
}

const COMBOS_2: ComboSpec[] = [
  { label: "poly · poly",     families: ["polygon", "polygon"] },
  { label: "poly · circle",   families: ["polygon", "circle"] },
  { label: "poly · star",     families: ["polygon", "star"] },
  { label: "circle · circle", families: ["circle", "circle"] },
  { label: "circle · star",   families: ["circle", "star"] },
  { label: "star · star",     families: ["star", "star"] },
];

const COMBOS_3: ComboSpec[] = [
  { label: "poly · poly · poly",   families: ["polygon", "polygon", "polygon"] },
  { label: "poly · poly · circle", families: ["polygon", "polygon", "circle"] },
  { label: "poly · poly · star",   families: ["polygon", "polygon", "star"] },
  { label: "poly · circle · star", families: ["polygon", "circle", "star"] },
  { label: "poly · star · star",   families: ["polygon", "star", "star"] },
  { label: "circ · circ · circ",   families: ["circle", "circle", "circle"] },
  { label: "circ · circ · star",   families: ["circle", "circle", "star"] },
  { label: "circ · star · star",   families: ["circle", "star", "star"] },
  { label: "star · star · star",   families: ["star", "star", "star"] },
];

const COMBO_STARTS = [0, 4, 8] as const;

function ComboMandala({ families, startPos, size = 110 }: {
  families: ShapeFamily[];
  startPos: number;
  size?: number;
}) {
  return (
    <svg
      viewBox={`${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`}
      width={size} height={size}
      className="select-none rounded-md border bg-card"
      aria-hidden
    >
      <circle cx={0} cy={0} r={RADIUS + 12} fill="none"
        className="stroke-border" strokeWidth={0.5} strokeDasharray="2 4" />
      {families.map((family, i) => {
        const { d } = shapeFromFamily(family, startPos + i, RADIUS, 0);
        return (
          <path key={i} d={d} vectorEffect="non-scaling-stroke"
            fill="none" stroke="currentColor"
            className="stroke-foreground"
            strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
            strokeOpacity={0.85}
          />
        );
      })}
    </svg>
  );
}

function ComboGroup({ title, combos }: { title: string; combos: ComboSpec[] }) {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-4">
        {combos.map((combo) => (
          <div key={combo.label} className="flex items-center gap-4">
            <span className="w-44 shrink-0 font-mono text-[10px] text-muted-foreground">{combo.label}</span>
            <div className="flex gap-3">
              {COMBO_STARTS.map((sp) => (
                <div key={sp} className="flex flex-col items-center gap-0.5">
                  <ComboMandala families={combo.families} startPos={sp} />
                  <span className="font-mono text-[9px] text-muted-foreground">
                    p{sp}–{sp + combo.families.length - 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CombosSection() {
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-serif text-base uppercase tracking-[0.2em]">Stack combinations</h3>
        <p className="text-xs text-muted-foreground">
          Flat radius · variant 0 · columns = p0 / p4 / p8.
          Complexity cap at p{COMPLEXITY_CAP} — shapes plateau beyond that position.
        </p>
      </div>
      <div className="overflow-x-auto space-y-8">
        <ComboGroup title="2 layers" combos={COMBOS_2} />
        <ComboGroup title="3 layers" combos={COMBOS_3} />
      </div>
    </section>
  );
}

// ── Reference grids (mode × variant, time scale, insets) ──────────────────

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
        width={size} height={size}
        className="select-none rounded-md border bg-card"
        aria-hidden
      >
        <circle cx={0} cy={0} r={RADIUS + 12} fill="none"
          className="stroke-border" strokeWidth={0.5} strokeDasharray="2 4" />
        <path d={d} vectorEffect="non-scaling-stroke"
          className="fill-none stroke-foreground"
          strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
          strokeOpacity={0.85} />
        {insetD && (
          <path d={insetD} vectorEffect="non-scaling-stroke"
            className="fill-none stroke-foreground"
            strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round"
            strokeOpacity={0.6} />
        )}
      </svg>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{label}</span>
      {sublabel && <span className="text-[9px] text-muted-foreground/60">{sublabel}</span>}
    </div>
  );
}

const TIME_BUCKETS = [
  { label: "morning · 5–12",  scale: scaleForTime(makeTs(8))  },
  { label: "midday · 12–17",  scale: scaleForTime(makeTs(14)) },
  { label: "evening · 17–22", scale: scaleForTime(makeTs(19)) },
  { label: "night · 22–5",    scale: scaleForTime(makeTs(23)) },
];

const INSET_KINDS: ReadonlyArray<{ kind: InsetKind; bucket: string }> = [
  { kind: "dot",      bucket: "morning · 5–12"  },
  { kind: "triangle", bucket: "midday · 12–17"  },
  { kind: "star",     bucket: "evening · 17–22" },
  { kind: "ring",     bucket: "night · 22–5"    },
];

function RulesLegend() {
  const rules = [
    { trigger: "session.mode",               effect: "shape family",    detail: "continuous→polygon · break→circle · gap→star" },
    { trigger: "position (0–19)",            effect: "shape complexity",detail: "increments sides / star preset per session" },
    { trigger: "day-of-year × 7 mod 3",      effect: "variant (0–2)",   detail: "0: default · 1: rotated half-step · 2: scale 0.88×" },
    { trigger: "startedAt hour",             effect: "radius scale",    detail: "morning 0.55 · midday 0.72 · evening 0.88 · night 1.0" },
    { trigger: "startedAt hour (top layer)", effect: "center inset",    detail: "dot · triangle · star · ring" },
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

function ModeBlock({ mode }: { mode: SessionMode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">{mode}</h3>
      <div className="space-y-2">
        {[0, 1, 2].map((variant) => (
          <div key={variant} className="flex items-start gap-3">
            <div className="w-28 shrink-0 pt-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">variant {variant}</div>
              <div className="text-[9px] text-muted-foreground/60">
                {variant === 1 ? "rotated half-step" : variant === 2 ? "scale 0.88×" : "default rotation"}
              </div>
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

function TimeScaleBlock() {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Time-of-day scale</h3>
      <p className="text-xs text-muted-foreground">
        Same shape (p2 continuous v0) at each bucket — guide ring shows full R.
      </p>
      <div className="flex flex-wrap gap-4">
        {TIME_BUCKETS.map(({ label, scale }) => {
          const { d } = shapeForVariant(2, "continuous", RADIUS * scale, 0);
          return <Cell key={label} d={d} label={`${scale.toFixed(2)}×`} sublabel={label} size={80} />;
        })}
      </div>
    </section>
  );
}

function InsetsBlock() {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-base uppercase tracking-[0.2em]">Center insets</h3>
      <p className="text-xs text-muted-foreground">Top layer only · r = R × 0.12</p>
      <div className="flex flex-wrap gap-4">
        {INSET_KINDS.map(({ kind, bucket }) => (
          <Cell key={kind} d={insetPath(kind, RADIUS)} label={kind} sublabel={bucket} size={72} />
        ))}
      </div>
    </section>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export function ShowcaseView({ className }: { className?: string }) {
  const sessions = useTimer((s) => s.sessions);

  const todayLayers = useMemo<GeometryLayer[]>(() => {
    const today = toYmd(Date.now());
    return sessions
      .filter((s) => s.kind === "work" && s.completed && toYmd(s.startedAt) === today)
      .map((s) => ({ mode: s.mode ?? "continuous", startedAt: s.startedAt }));
  }, [sessions]);

  const groups = useMemo<Group[]>(() => {
    const synth = [...SYNTHETIC_GROUPS];
    if (todayLayers.length > 0) {
      synth.unshift({
        label: "today",
        desc: `${todayLayers.length} session${todayLayers.length !== 1 ? "s" : ""} from store`,
        layers: todayLayers,
      });
    }
    return synth;
  }, [todayLayers]);

  return (
    <div className={cn("space-y-10", className)}>
      <header className="space-y-1">
        <h2 className="font-serif text-2xl">Shape showcase</h2>
        <p className="text-sm text-muted-foreground">
          Experiments compare different family-assignment rules across session groups.
          Real store data appears as "today" when sessions exist.
        </p>
      </header>
      <ExperimentsSection groups={groups} />
      <CombosSection />
      <RulesLegend />
      {MODES.map((mode) => <ModeBlock key={mode} mode={mode} />)}
      <TimeScaleBlock />
      <InsetsBlock />
    </div>
  );
}
