"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A staged system diagram: nodes laid out on a 3x3 grid, one animated edge per
 * step, auto-advancing with a progress bar the reader can click through.
 *
 * Edges are drawn in an SVG overlay from *measured* node positions rather than
 * from the grid spec, so the same component works at any width and the routing
 * never drifts out of sync with the layout.
 */

export type FlowNode = {
  id: string;
  /** Small uppercase tag above the name — usually which side of the wire it lives on. */
  kicker: string;
  label: string;
  detail?: string;
  /** 1-based grid position, applied from the `sm` breakpoint up. */
  col: 1 | 2 | 3;
  row: 1 | 2 | 3;
};

export type FlowStep = {
  from: string;
  to: string;
  /**
   * For edges that change both row and column: which axis the line leaves the
   * source node on. Ignored for straight edges.
   */
  elbow?: "vertical" | "horizontal";
  title: string;
  body: string;
};

type Box = { x: number; y: number; w: number; h: number };
type Geometry = { d: string; tipX: number; tipY: number; angle: number };

const STEP_MS = 3600;
const CORNER = 18;

const COL_START: Record<number, string> = {
  1: "sm:col-start-1",
  2: "sm:col-start-2",
  3: "sm:col-start-3",
};

const ROW_START: Record<number, string> = {
  1: "sm:row-start-1",
  2: "sm:row-start-2",
  3: "sm:row-start-3",
};

const round = (n: number): string => (Math.round(n * 10) / 10).toString();

/** Renders `backticked` spans as code, so step copy can name real endpoints. */
function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={`${i}-${part}`}
            className="rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground"
          >
            {part}
          </code>
        ) : (
          <span key={`${i}-${part}`}>{part}</span>
        ),
      )}
    </>
  );
}

function buildGeometry(a: Box, b: Box, elbow: "vertical" | "horizontal"): Geometry {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const sameRow = overlapY > Math.min(a.h, b.h) * 0.5;
  const sameCol = overlapX > Math.min(a.w, b.w) * 0.5;
  const right = b.x + b.w / 2 > a.x + a.w / 2;
  const down = b.y + b.h / 2 > a.y + a.h / 2;

  if (sameRow && !sameCol) {
    const sx = right ? a.x + a.w : a.x;
    const sy = a.y + a.h / 2;
    const ex = right ? b.x : b.x + b.w;
    const ey = b.y + b.h / 2;
    const bend = (ex - sx) / 2;
    return {
      d: `M ${round(sx)} ${round(sy)} C ${round(sx + bend)} ${round(sy)}, ${round(ex - bend)} ${round(ey)}, ${round(ex)} ${round(ey)}`,
      tipX: ex,
      tipY: ey,
      angle: right ? 0 : 180,
    };
  }

  if (sameCol && !sameRow) {
    const sx = a.x + a.w / 2;
    const sy = down ? a.y + a.h : a.y;
    const ex = b.x + b.w / 2;
    const ey = down ? b.y : b.y + b.h;
    const bend = (ey - sy) / 2;
    return {
      d: `M ${round(sx)} ${round(sy)} C ${round(sx)} ${round(sy + bend)}, ${round(ex)} ${round(ey - bend)}, ${round(ex)} ${round(ey)}`,
      tipX: ex,
      tipY: ey,
      angle: down ? 90 : 270,
    };
  }

  const hSign = right ? 1 : -1;
  const vSign = down ? 1 : -1;

  if (elbow === "vertical") {
    // Leave vertically, turn once, arrive at the target's near side.
    const sx = a.x + a.w / 2;
    const sy = down ? a.y + a.h : a.y;
    const cy = b.y + b.h / 2;
    const ex = right ? b.x : b.x + b.w;
    const r = Math.max(0, Math.min(CORNER, Math.abs(cy - sy) / 2, Math.abs(ex - sx) / 2));
    return {
      d: `M ${round(sx)} ${round(sy)} L ${round(sx)} ${round(cy - r * vSign)} Q ${round(sx)} ${round(cy)} ${round(sx + r * hSign)} ${round(cy)} L ${round(ex)} ${round(cy)}`,
      tipX: ex,
      tipY: cy,
      angle: right ? 0 : 180,
    };
  }

  // Leave horizontally, turn once, arrive at the target's top or bottom.
  const sx = right ? a.x + a.w : a.x;
  const sy = a.y + a.h / 2;
  const cx = b.x + b.w / 2;
  const ey = down ? b.y : b.y + b.h;
  const r = Math.max(0, Math.min(CORNER, Math.abs(cx - sx) / 2, Math.abs(ey - sy) / 2));
  return {
    d: `M ${round(sx)} ${round(sy)} L ${round(cx - r * hSign)} ${round(sy)} Q ${round(cx)} ${round(sy)} ${round(cx)} ${round(sy + r * vSign)} L ${round(cx)} ${round(ey)}`,
    tipX: cx,
    tipY: ey,
    angle: down ? 90 : 270,
  };
}

export function FlowDiagram({
  nodes,
  steps,
  label,
}: {
  nodes: readonly FlowNode[];
  steps: readonly FlowStep[];
  /** Accessible name for the diagram region. */
  label: string;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [current, setCurrent] = useState(0);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [manual, setManual] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const base = grid.getBoundingClientRect();
    const next: Record<string, Box> = {};
    for (const el of grid.querySelectorAll<HTMLElement>("[data-flow-node]")) {
      const id = el.dataset.flowNode;
      if (!id) continue;
      const r = el.getBoundingClientRect();
      next[id] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    }
    setBoxes(next);
    setSize({ w: base.width, h: base.height });
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    for (const el of grid.querySelectorAll<HTMLElement>("[data-flow-node]")) observer.observe(el);
    // Web-font swap reflows the cards after first paint.
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.25 },
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const autoplay = inView && !manual && !hovered && !reducedMotion;

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(() => setCurrent((step) => (step + 1) % steps.length), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, current, steps.length]);

  const geometries = useMemo(
    () =>
      steps.map((step) => {
        const from = boxes[step.from];
        const to = boxes[step.to];
        if (!from || !to) return null;
        return buildGeometry(from, to, step.elbow ?? "vertical");
      }),
    [steps, boxes],
  );

  // A node is lit while it's an endpoint of the current step, and stays settled
  // once the flow has passed through it.
  const nodeState = (id: string): "active" | "done" | "idle" => {
    const step = steps[current];
    if (step && (step.from === id || step.to === id)) return "active";
    for (let i = 0; i < current; i += 1) {
      const past = steps[i];
      if (past && (past.from === id || past.to === id)) return "done";
    }
    return "idle";
  };

  const active = steps[current];

  return (
    <div
      className="flex flex-col gap-8"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={gridRef}
        role="img"
        aria-label={label}
        className="relative grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3 sm:gap-y-14"
      >
        {size.w > 0 ? (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
            viewBox={`0 0 ${round(size.w)} ${round(size.h)}`}
            fill="none"
          >
            {steps.map((step, i) => {
              const geometry = geometries[i];
              if (!geometry) return null;
              const state = i === current ? "active" : i < current ? "done" : "idle";
              return (
                <g
                  key={`${step.from}-${step.to}`}
                  className={cn(
                    "transition-opacity duration-500",
                    state === "idle" && "opacity-40",
                  )}
                >
                  <path
                    d={geometry.d}
                    strokeWidth={state === "active" ? 2 : 1.5}
                    strokeLinecap="round"
                    className={cn(
                      "transition-colors duration-500",
                      state === "active" ? "stroke-brand" : "stroke-border",
                    )}
                    strokeDasharray={state === "idle" ? "3 5" : undefined}
                  />
                  {state === "active" ? (
                    <path
                      d={geometry.d}
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      className="cafe-flow-dash stroke-brand"
                    />
                  ) : null}
                  <path
                    d="M 0 0 L -8 -4.5 L -8 4.5 Z"
                    transform={`translate(${round(geometry.tipX)} ${round(geometry.tipY)}) rotate(${geometry.angle})`}
                    className={cn(
                      "transition-colors duration-500",
                      state === "active" ? "fill-brand" : "fill-border",
                    )}
                  />
                </g>
              );
            })}
          </svg>
        ) : null}

        {nodes.map((node) => {
          const state = nodeState(node.id);
          return (
            <div
              key={node.id}
              data-flow-node={node.id}
              className={cn(
                "relative z-10 self-start rounded-xl border bg-card px-4 py-3 transition-all duration-500",
                COL_START[node.col],
                ROW_START[node.row],
                state === "active" && "border-brand shadow-[0_0_0_5px_var(--brand-soft)]",
                state === "done" && "border-border",
                state === "idle" && "border-dashed opacity-55",
              )}
            >
              <p
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-500",
                  state === "active" ? "text-brand" : "text-muted-foreground",
                )}
              >
                {node.kicker}
              </p>
              <p className="mt-1.5 text-sm leading-tight font-semibold">{node.label}</p>
              {node.detail ? (
                <p className="mt-1 font-mono text-[11px] leading-snug text-muted-foreground">
                  {node.detail}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {steps.map((step, i) => (
              <button
                key={`${step.from}-${step.to}`}
                type="button"
                onClick={() => {
                  setCurrent(i);
                  setManual(true);
                }}
                aria-label={`Step ${i + 1}: ${step.title}`}
                aria-current={i === current ? "step" : undefined}
                className="group h-6 flex-1 cursor-pointer"
              >
                <span className="block h-1 w-full overflow-hidden rounded-full bg-border transition-colors group-hover:bg-muted-foreground/40">
                  <span
                    className={cn(
                      "block h-full w-full rounded-full bg-brand",
                      i < current && "scale-x-100",
                      i > current && "scale-x-0",
                      i === current && (autoplay ? "cafe-progress" : "scale-x-100"),
                    )}
                    style={
                      i === current && autoplay ? { animationDuration: `${STEP_MS}ms` } : undefined
                    }
                  />
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setManual((value) => !value)}
            aria-label={manual ? "Play the sequence" : "Pause the sequence"}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border text-muted-foreground transition-colors hover:text-foreground"
          >
            {manual ? <Play className="size-3" /> : <Pause className="size-3" />}
          </button>
        </div>

        {active ? (
          <div className="min-h-24 sm:min-h-20">
            <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Step {current + 1} / {steps.length}
            </p>
            <p className="mt-2 text-base font-semibold">{active.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              <InlineCode text={active.body} />
            </p>
          </div>
        ) : null}

        {/* Full sequence for assistive tech and no-JS readers. */}
        <ol className="sr-only">
          {steps.map((step) => (
            <li key={`${step.from}-${step.to}`}>
              {step.title}. <InlineCode text={step.body} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
