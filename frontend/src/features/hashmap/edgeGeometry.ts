import type { Edge } from "./graph";
import type { Band, PlacedNode } from "./layout";
export function edgeGeometry(
  edge: Edge,
  positions: { get(id: number): PlacedNode | undefined },
  bands: Map<string, Band>,
  width: number,
) {
  const from = edge.from === null ? undefined : positions.get(edge.from),
    to = positions.get(edge.to);
  const band = edge.areaId ? bands.get(edge.areaId) : undefined;
  if (!from && !band) return;
  const cross =
    !to || (from ? from.areaId !== to.areaId : band?.id !== to.areaId);
  const x1 = from
    ? from.x +
      (edge.tree
        ? 58
        : edge.field === "parent"
          ? 58
          : edge.field === "prev"
            ? 0
            : 116)
    : 112;
  const y1 = from
    ? from.y + (edge.tree ? 65 : edge.field === "parent" ? 0 : 32)
    : band!.y + (edge.field === "head" ? 64 : 85);
  const x2 = to
    ? to.x +
      (edge.tree || edge.field === "parent"
        ? 58
        : edge.field === "prev"
          ? 116
          : 0)
    : width - 30;
  const y2 = to
    ? to.y + (edge.tree ? 0 : edge.field === "parent" ? 65 : 32)
    : y1 + 26;
  const routeX =
    132 -
    ["left", "right", "parent", "next", "prev", "head", "root"].indexOf(
      edge.field,
    ) *
      7;
  const path = cross
    ? `M ${x1} ${y1} H ${routeX} V ${y2} H ${x2}`
    : `M ${x1} ${y1} L ${x2} ${y2}`;
  return {
    path,
    labelX: cross ? routeX + 3 : (x1 + x2) / 2 + 6,
    labelY: cross ? (y1 + y2) / 2 - 5 : (y1 + y2) / 2 - 6,
    external: !to,
  };
}
