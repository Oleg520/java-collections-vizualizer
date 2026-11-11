import { useLayoutEffect, useMemo, useRef } from "react";

import type { MapNode, Step, Trace } from "../../api/types";
import type { PlaybackNavigation } from "../../playback/useTracePlayback";
import { areaLabel, type Edge, type SnapshotGraph } from "./graph";
import type { Diagram, PlacedNode } from "./layout";
import { edgeGeometry } from "./edgeGeometry";
import { keyLabel, valueLabel } from "./presentation";
import { useDiagramTransition } from "./useDiagramTransition";

export function HashMapGraph({
  layout,
  focusedBucket,
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
  focusedBucket: number | null;
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
  const nodeElements = useRef(new Map<number, SVGGElement>());
  const edgeElements = useRef(
    new Map<
      string,
      {
        path: SVGPathElement;
        hit: SVGPathElement | null;
        label: SVGTextElement;
      }
    >(),
  );
  const bands = useMemo(
    () => new Map(layout.bands.map((b) => [b.id, b])),
    [layout],
  );
  useLayoutEffect(() => {
    const draw = (fraction: number) => {
      const positions = new Map(
        layout.nodes.map((n) => [
          n.node.objectId,
          transition.positionAt(n.node.objectId, fraction)!,
        ]),
      );
      for (const [id, node] of positions)
        nodeElements.current
          .get(id)
          ?.setAttribute("transform", `translate(${node.x} ${node.y})`);
      for (const edge of layout.edges) {
        const elements = edgeElements.current.get(edge.id),
          geometry = edgeGeometry(edge, positions, bands, cameraWidth);
        if (!elements || !geometry) continue;
        elements.path.setAttribute("d", geometry.path);
        elements.hit?.setAttribute("d", geometry.path);
        elements.label.setAttribute("x", String(geometry.labelX));
        elements.label.setAttribute("y", String(geometry.labelY));
      }
    };
    draw(transition.progress.get());
    return transition.progress.on("change", draw);
  }, [layout, bands, cameraWidth, transition.progress, transition.positionAt]);
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
        <g
          key={b.id}
          data-area={b.id}
          opacity={
            focusedBucket !== null && focusedBucket !== b.index ? 0.3 : 1
          }
        >
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
      {layout.edges.map((edge) => {
        const geometry = edgeGeometry(edge, transition.to, bands, cameraWidth)!;
        const title = `${edge.from === null ? `${edge.areaId} snapshot` : `obj ${edge.from}`} · ${edge.field} → obj ${edge.to}${geometry.external ? ", вне фокуса" : ""}`;
        return (
          <g
            key={edge.id}
            data-edge={edge.id}
            ref={(element) => {
              if (element)
                edgeElements.current.set(edge.id, {
                  path: element.querySelector("path")!,
                  hit: element.querySelector(".edge-hit"),
                  label: element.querySelector("text")!,
                });
              else edgeElements.current.delete(edge.id);
            }}
            className={`physical-edge ${selectedEdge?.id === edge.id ? "selected" : ""} ${edge.from !== null && transition.changed.has(edge.from) ? "changed" : ""} ${edge.tree || edge.field === "next" ? "structural" : "secondary"}`}
          >
            <path d={geometry.path} markerEnd="url(#arrow)" />
            {physical && (
              <path
                d={geometry.path}
                className="edge-hit"
                role="button"
                tabIndex={0}
                aria-label={title}
                onClick={() => onEdge(edge)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdge(edge);
                  }
                }}
              />
            )}
            <text
              x={geometry.labelX}
              y={geometry.labelY}
              className="svg-edge-label"
            >
              {geometry.external
                ? `${edge.label} → obj ${edge.to} · вне фокуса`
                : edge.label}
            </text>
            <title>{title}</title>
          </g>
        );
      })}
      {layout.nodes.map((placed) => (
        <Node
          key={placed.node.objectId}
          placed={placed}
          active={highlighted.has(placed.node.objectId)}
          dimmed={focusedBucket !== null && focusedBucket !== placed.bucket}
          changed={transition.changed.has(placed.node.objectId)}
          onSelect={onSelect}
          register={(element) => {
            if (element)
              nodeElements.current.set(placed.node.objectId, element);
            else nodeElements.current.delete(placed.node.objectId);
          }}
        />
      ))}
    </svg>
  );
}
function Node({
  placed: { node, pending, areaId, x, y },
  active,
  dimmed,
  changed,
  onSelect,
  register,
}: {
  placed: PlacedNode;
  active: boolean;
  dimmed: boolean;
  changed: boolean;
  onSelect: (node: MapNode) => void;
  register: (element: SVGGElement | null) => void;
}) {
  return (
    <g
      ref={register}
      transform={`translate(${x} ${y})`}
      style={{ cursor: "pointer" }}
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
      opacity={!active && dimmed ? 0.3 : pending && !active ? 0.8 : 1}
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
    </g>
  );
}
function short(value: string, length: number) {
  return value.length > length ? value.slice(0, length - 1) + "…" : value;
}
