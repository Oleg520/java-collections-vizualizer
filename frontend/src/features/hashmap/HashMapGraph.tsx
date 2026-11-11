import { useMemo } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import type { MapNode, Step, Trace } from "../../api/types";
import type { PlaybackNavigation } from "../../playback/useTracePlayback";
import { areaLabel, type Edge, type SnapshotGraph } from "./graph";
import type { Diagram, PlacedNode } from "./layout";
import { edgeGeometry } from "./edgeGeometry";
import { keyLabel, valueLabel } from "./presentation";
import { useDiagramTransition } from "./useDiagramTransition";

type MovingPositions = {
  progress: MotionValue<number>;
  positionAt: (id: number, fraction: number) => PlacedNode | undefined;
};
export function HashMapGraph({
  layout,
  graph,
  cameraWidth,
  scale,
  physical,
  selected,
  selectedEdge,
  step,
  onSelect,
  onEdge,
  trace,
  cursor,
  navigation,
  speed,
  playing,
  view,
}: {
  layout: Diagram;
  graph: SnapshotGraph;
  cameraWidth: number;
  scale: number;
  physical: boolean;
  selected?: MapNode;
  selectedEdge?: Edge;
  step?: Step;
  onSelect: (node: MapNode) => void;
  onEdge: (edge: Edge) => void;
  trace?: Trace;
  cursor: number;
  navigation: PlaybackNavigation;
  speed: number;
  playing: boolean;
  view: string;
}) {
  const transition = useDiagramTransition(
    layout,
    trace,
    cursor,
    view,
    navigation,
    speed,
    playing,
  );
  const highlighted = useMemo(
    () =>
      new Set([
        selected?.objectId,
        selectedEdge?.from,
        selectedEdge?.to,
        step?.details.nodeObjectId,
      ]),
    [selected, selectedEdge, step],
  );
  return (
    <svg
      width={cameraWidth * scale}
      height={layout.height * scale}
      viewBox={`0 0 ${cameraWidth} ${layout.height}`}
      role="img"
      aria-label="Узлы, цепочки и красно-чёрные деревья HashMap"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {layout.bands.map((b) => (
        <g key={b.id} data-area={b.id}>
          <rect
            x="14"
            y={b.y}
            width={cameraWidth - 28}
            height={b.height}
            rx="12"
            className={`band ${b.area.source}`}
          />
          <text x="30" y={b.y + 27} className="svg-bucket">
            {b.area.source === "transfer"
              ? "ВРЕМЕННЫЕ"
              : b.area.source === "old" || graph.starting
                ? "СТАРАЯ"
                : graph.expanding
                  ? "НОВАЯ"
                  : "БАКЕТ"}{" "}
            [{b.index}]
          </text>
          <text x="30" y={b.y + 45} className="svg-kind">
            {b.kind === "TREE"
              ? "RB TREE"
              : b.kind === "TRANSFER"
                ? "PHYSICAL OBJECTS"
                : "LINKED LIST"}
          </text>
          <title>
            {areaLabel(b.area, graph)}; размещение объектов snapshot
          </title>
        </g>
      ))}
      {layout.edges.map((edge) => (
        <MovingEdge
          key={edge.id}
          edge={edge}
          layout={layout}
          width={cameraWidth}
          physical={physical}
          selected={selectedEdge?.id === edge.id}
          changed={edge.from !== null && transition.changed.has(edge.from)}
          onChoose={onEdge}
          progress={transition.progress}
          positionAt={transition.positionAt}
        />
      ))}
      {layout.nodes.map((placed) => (
        <MovingNode
          key={placed.node.objectId}
          placed={placed}
          active={highlighted.has(placed.node.objectId)}
          changed={transition.changed.has(placed.node.objectId)}
          onSelect={onSelect}
          progress={transition.progress}
          positionAt={transition.positionAt}
        />
      ))}
    </svg>
  );
}
function MovingEdge({
  edge,
  layout,
  width,
  physical,
  selected,
  changed,
  onChoose,
  progress,
  positionAt,
}: MovingPositions & {
  edge: Edge;
  layout: Diagram;
  width: number;
  physical: boolean;
  selected: boolean;
  changed: boolean;
  onChoose: (edge: Edge) => void;
}) {
  const geometryAt = (fraction: number) =>
    edgeGeometry(
      edge,
      { get: (id) => positionAt(id, fraction) },
      layout,
      width,
    )!;
  // Every endpoint, node and label reads the same progress value, including new edges.
  const path = useTransform(progress, (p) => geometryAt(p).path);
  const labelX = useTransform(progress, (p) => geometryAt(p).labelX);
  const labelY = useTransform(progress, (p) => geometryAt(p).labelY);
  const external = !positionAt(edge.to, 1);
  const title = `${edge.from === null ? edge.areaId : `obj ${edge.from}`} · ${edge.field} → obj ${edge.to}${external ? ", вне фокуса" : ""}`;
  return (
    <g
      data-edge={edge.id}
      className={`physical-edge ${selected ? "selected" : ""} ${changed ? "changed" : ""} ${edge.tree || edge.field === "next" ? "structural" : "secondary"}`}
    >
      <motion.path d={path} markerEnd="url(#arrow)" />
      {physical && (
        <motion.path
          d={path}
          className="edge-hit"
          role="button"
          tabIndex={0}
          aria-label={title}
          onClick={() => onChoose(edge)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChoose(edge);
            }
          }}
        />
      )}
      <motion.text x={labelX} y={labelY} className="svg-edge-label">
        {external ? `${edge.label} → obj ${edge.to} · вне фокуса` : edge.label}
      </motion.text>
      <title>{title}</title>
    </g>
  );
}
function MovingNode({
  placed: { node, pending, areaId },
  active,
  changed,
  onSelect,
  progress,
  positionAt,
}: MovingPositions & {
  placed: PlacedNode;
  active: boolean;
  changed: boolean;
  onSelect: (node: MapNode) => void;
}) {
  const x = useTransform(progress, (p) => positionAt(node.objectId, p)!.x);
  const y = useTransform(progress, (p) => positionAt(node.objectId, p)!.y);
  return (
    <motion.g
      style={{ x, y, cursor: "pointer" }}
      data-object-id={node.objectId}
      data-entry-id={node.id}
      data-linked={node.linked}
      role="button"
      tabIndex={0}
      aria-label={`Узел ${keyLabel(node.key)}, запись ${node.id}, объект ${node.objectId}, ${areaId}, ${node.red === null ? "список" : node.red ? "красный" : "чёрный"}${node.linked ? "" : ", вне цепочки"}`}
      onClick={() => onSelect(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(node);
        }
      }}
      opacity={pending && !active ? 0.8 : 1}
    >
      <title>{`${keyLabel(node.key)} → ${valueLabel(node.value)}\nid: ${node.id}; objectId: ${node.objectId}\nparent=${node.parent}; left=${node.left}; right=${node.right}; next=${node.next}; prev=${node.prev}`}</title>
      <rect
        width="116"
        height="65"
        rx="9"
        strokeDasharray={!node.linked ? "4 3" : undefined}
        className={`map-node ${active ? "highlighted" : ""} ${changed ? "changed" : ""} ${node.red === true ? "red-node" : node.red === false ? "black-node" : ""}`}
      />
      <line x1="0" y1="35" x2="116" y2="35" stroke="#35483c" />
      {node.red !== null && (
        <text x="102" y="15" textAnchor="middle" className="node-color">
          {node.red ? "R" : "B"}
        </text>
      )}
      <text x="12" y="23" className="svg-key">
        {short(keyLabel(node.key), 12)}
      </text>
      <text x="12" y="54" className="svg-value">
        {short(valueLabel(node.value), 13)}
      </text>
      <text x="57" y="81" textAnchor="middle" className="svg-node-id">
        #{node.id} · obj {node.objectId}
      </text>
      {!node.linked && (
        <text x="57" y="95" textAnchor="middle" className="svg-node-id">
          вне цепочки
        </text>
      )}
    </motion.g>
  );
}
function short(value: string, length: number) {
  return value.length > length ? value.slice(0, length - 1) + "…" : value;
}
