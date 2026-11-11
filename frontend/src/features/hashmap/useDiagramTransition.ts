import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { animate, useMotionValue } from "motion/react";
import type { Trace } from "../../api/types";
import type { PlaybackNavigation } from "../../playback/useTracePlayback";
import type { Diagram } from "./layout";
import {
  canAnimateTransition,
  changedObjects,
  transitionDuration,
} from "./transitions";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const reducedMotion = () => window.matchMedia(query).matches;

/** A single bounded HashMap transition; it never changes or queues Java snapshots. */
export function useDiagramTransition(
  layout: Diagram,
  trace: Trace | undefined,
  cursor: number,
  view: string,
  navigation: PlaybackNavigation,
  speed: number,
  playing: boolean,
) {
  const reduced = useSyncExternalStore(subscribe, reducedMotion, () => false);
  const previous = useRef<{
    layout: Diagram;
    trace?: Trace;
    cursor: number;
    view: string;
  }>(undefined);
  const running = useRef(false);
  const progress = useMotionValue(1);
  const pair = useMemo(() => {
    const animate = canAnimateTransition(
      previous.current,
      { trace, cursor, view },
      navigation,
      reduced,
      running.current,
    );
    const from = new Map(
      (animate ? previous.current!.layout : layout).nodes.map((n) => [
        n.node.objectId,
        n,
      ]),
    );
    const to = new Map(layout.nodes.map((n) => [n.node.objectId, n]));
    const changed =
      previous.current &&
      previous.current.trace === trace &&
      Math.abs(previous.current.cursor - cursor) === 1 &&
      (navigation === "step" || navigation === "play")
        ? changedObjects(previous.current.layout, layout)
        : new Set<number>();
    return { animate, from, to, changed };
    // playing/speed changes settle the current effect, including pause at a fractional position.
  }, [layout, trace, cursor, view, navigation, reduced, speed, playing]);
  useLayoutEffect(() => {
    previous.current = { layout, trace, cursor, view };
    running.current = pair.animate;
    progress.set(pair.animate ? 0 : 1);
    if (!pair.animate) return;
    const animation = animate(progress, 1, {
      duration: transitionDuration(speed),
      ease: "easeInOut",
      onComplete: () => {
        running.current = false;
      },
    });
    return () => {
      animation.stop();
      running.current = false;
    };
  }, [pair, layout, trace, cursor, view, speed, progress]);
  const positionAt = (id: number, fraction: number) => {
    const to = pair.to.get(id);
    if (!to) return undefined;
    const from = pair.from.get(id) ?? to;
    return {
      ...to,
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction,
    };
  };
  return { progress, positionAt, changed: pair.changed, to: pair.to };
}
