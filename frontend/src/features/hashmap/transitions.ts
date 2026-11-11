import type { Trace } from "../../api/types";
import type { Diagram } from "./layout";
import type { PlaybackNavigation } from "../../playback/useTracePlayback";

export function transitionDuration(speed: number) {
  return Math.min(0.22, 0.7 / speed);
}
export function canAnimateTransition(
  previous: { trace?: Trace; cursor: number; view: string } | undefined,
  next: { trace?: Trace; cursor: number; view: string },
  navigation: PlaybackNavigation,
  reduced: boolean,
  interrupted: boolean,
) {
  return (
    !reduced &&
    !interrupted &&
    !!next.trace &&
    previous?.trace === next.trace &&
    previous.view === next.view &&
    Math.abs(previous.cursor - next.cursor) === 1 &&
    (navigation === "step" || navigation === "play")
  );
}
export function changedObjects(before: Diagram, after: Diagram) {
  const previous = new Map(before.nodes.map((n) => [n.node.objectId, n.node]));
  const changed = new Set<number>();
  for (const { node } of after.nodes) {
    const old = previous.get(node.objectId);
    if (
      !old ||
      (["left", "right", "parent", "next", "prev", "red"] as const).some(
        (field) => old[field] !== node[field],
      )
    )
      changed.add(node.objectId);
  }
  return changed;
}
