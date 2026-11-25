// Single loading placeholder for every route and in-view load. Route loading.tsx and the
// in-view loaders render the same shape, so the hand-off between them is invisible.
import type { CSSProperties } from "react";
import ui from "./ui.module.css";

export type SkeletonShape = "bento" | "list" | "chat";

const cx = (...names: Array<string | false>) => names.filter(Boolean).join(" ");

/** One shimmering block. Decorative, so hidden from assistive tech. */
export function ShimmerBlock({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cx(ui.shimmer, ui.block, className ?? false)} style={style} />;
}

export function Skeleton({ shape }: { shape: SkeletonShape }) {
  return (
    <div className={ui.root} role="status" aria-busy="true" data-skeleton data-shape={shape}>
      <span className="sr-only">Loading</span>
      <ShimmerBlock className={ui.bar} />
      {shape === "bento" ? (
        <>
          <div className={ui.grid} aria-hidden>
            <ShimmerBlock className={ui.tile} />
            <ShimmerBlock className={ui.tile} />
            <ShimmerBlock className={ui.tile} />
          </div>
          <ShimmerBlock className={ui.wide} />
        </>
      ) : null}
      {shape === "list" ? (
        <div className={ui.list} aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => <ShimmerBlock key={i} className={ui.row} />)}
        </div>
      ) : null}
      {shape === "chat" ? (
        <>
          <div className={ui.pills} aria-hidden>
            <ShimmerBlock className={ui.pill} />
            <ShimmerBlock className={ui.pill} />
            <ShimmerBlock className={ui.pill} />
          </div>
          <ShimmerBlock className={ui.panel} />
        </>
      ) : null}
    </div>
  );
}
