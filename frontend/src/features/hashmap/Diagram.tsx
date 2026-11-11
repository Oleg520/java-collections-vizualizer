import { resolveSelection, type NodeSelection } from "./identity";
import { keyLabel, valueLabel } from "./presentation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Boxes, Maximize, Minus, Plus, ScanLine } from "lucide-react";
import {
  layoutSnapshot,
  type Diagram as DiagramLayout,
  type PlacedNode,
} from "./layout";
import {
  areaLabel,
  snapshotGraph,
  type Edge,
  type SnapshotGraph,
} from "./graph";
import { traceLayoutBounds } from "./traceLayout";
import {
  type MapNode,
  type Snapshot,
  type Step,
  type Trace,
} from "../../api/types";

export function Diagram({
  state,
  step,
  trace,
  onSelect,
  selectedId,
}: {
  state: Snapshot;
  step?: Step;
  trace?: Trace;
  onSelect: (node: MapNode) => void;
  selectedId?: NodeSelection;
}) {
  const graph = useMemo(() => snapshotGraph(state, step), [state, step]);
  const bounds = useMemo(() => traceLayoutBounds(trace), [trace]);
  const selected = resolveSelection(state, selectedId);
  const [focus, setFocus] = useState<{
    trace?: Trace;
    group: number | "auto" | "all";
  }>({ group: "auto" });
  const focusChoice = focus.trace === trace ? focus.group : "auto";
  const selectedGroup =
    selected && graph.locations.get(selected.objectId)?.group;
  const group = graph.expanding
    ? typeof focusChoice === "number"
      ? focusChoice
      : focusChoice === "all"
        ? null
        : (selectedGroup ?? graph.activeGroup ?? null)
    : null;
  const focusOn = (value: number | "auto" | "all") =>
    setFocus({ trace, group: value });
  const [physical, setPhysical] = useState(false);
  const layout = useMemo(
    () => layoutSnapshot(state, { graph, group, physical, bounds }),
    [state, graph, group, physical, bounds],
  );
  const cameraWidth = Math.max(
    layout.width,
    ...(group === null
      ? [...bounds.values()].map((b) => b.width)
      : [bounds.get(group)?.width ?? 0]),
  );
  const [zoom, setZoom] = useState<number | "fit" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingCenter = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(800);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setViewportWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 680px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 680px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const fitScale = Math.min(1, viewportWidth / cameraWidth);
  const scale = zoom === "fit" ? fitScale : (zoom ?? (mobile ? 1 : fitScale));
  const positions = useMemo(
    () => new Map(layout.nodes.map((n) => [n.node.objectId, n])),
    [layout],
  );
  const centerOn = (id: number) => {
    const node = positions.get(id),
      element = scrollRef.current;
    if (!element || !node) return;
    element.scrollTo({
      left: (node.x + 58) * scale - element.clientWidth / 2,
      top: (node.y + 32) * scale + 8 - element.clientHeight / 2,
      behavior: "instant",
    });
  };
  const reveal = (id: number) => {
    if (positions.has(id)) centerOn(id);
    else {
      pendingCenter.current = id;
      focusOn("all");
    }
  };
  useLayoutEffect(() => {
    if (
      pendingCenter.current !== null &&
      positions.has(pendingCenter.current)
    ) {
      centerOn(pendingCenter.current);
      pendingCenter.current = null;
    }
  });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [focusedBucket, setFocusedBucket] = useState<number | null>(null);
  const [tablesOpen, setTablesOpen] = useState(false);
  const [relationship, setRelationship] = useState<{
    state: Snapshot;
    id: string;
  }>();
  const selectedEdge =
    relationship?.state === state
      ? graph.edges.find((e) => e.id === relationship.id)
      : undefined;
  const chooseEdge = (edge: Edge) => setRelationship({ state, id: edge.id });
  const occupied = new Map(state.buckets.map((b) => [b.index, b]));
  const activeBucket =
    typeof step?.details.bucketIndex === "number"
      ? step.details.bucketIndex
      : typeof step?.details.toBucket === "number"
        ? step.details.toBucket
        : null;
  const indexList = hideEmpty
    ? state.buckets.map((b) => b.index)
    : Array.from({ length: state.capacity }, (_, i) => i);
  const groups = [...new Set(graph.areas.map((a) => a.group))].sort(
    (a, b) => a - b,
  );
  const outgoing = selected
    ? graph.edges.filter((e) => e.from === selected.objectId)
    : [];
  const resetZoom = () => {
    setZoom(null);
    setFocusedBucket(null);
    focusOn("auto");
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "instant" });
  };
  return (
    <section
      className={`visualization panel hashmap-diagram ${graph.expanding ? "is-resizing" : ""}`}
      aria-label="Визуализация HashMap"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">MEMORY VIEW</span>
          <h2>
            Внутри HashMap <span className="small-tag">Java 21</span>
          </h2>
        </div>
        <div className="zoom-controls">
          <button
            className="icon-button"
            aria-label="Уменьшить масштаб"
            onClick={() => setZoom(Math.max(0.1, scale - 0.15))}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            className="icon-button"
            aria-label="Масштаб 100%"
            onClick={() => setZoom(1)}
          >
            <code>1:1</code>
          </button>
          <button
            className="icon-button"
            aria-label="Увеличить масштаб"
            onClick={() => setZoom(Math.min(1.6, scale + 0.15))}
          >
            <Plus size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Вместить по ширине"
            title="Вместить по ширине"
            onClick={() => {
              setZoom("fit");
              scrollRef.current?.scrollTo({
                left: 0,
                top: 0,
                behavior: "instant",
              });
            }}
          >
            <Maximize size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Сбросить масштаб"
            onClick={resetZoom}
          >
            <ScanLine size={15} />
          </button>
        </div>
      </div>
      <div className="bucket-overview">
        {graph.expanding ? (
          <div className="resize-overview">
            <div className="resize-counts" aria-label="Состояние переноса">
              <strong>Map: {state.size} записей</strong>
              <span>
                Новая таблица:{" "}
                <b>
                  {state.buckets.length}/{state.capacity}
                </b>{" "}
                занято
              </span>
              <span>
                Старая таблица:{" "}
                <b>
                  {graph.oldOccupied}/{graph.oldCapacity}
                </b>{" "}
                ожидают переноса
              </span>
            </div>
            <div className="resize-focus">
              <label>
                Показать{" "}
                <select
                  aria-label="Фокус переноса"
                  value={focusChoice}
                  onChange={(e) =>
                    focusOn(
                      e.target.value === "auto" || e.target.value === "all"
                        ? e.target.value
                        : Number(e.target.value),
                    )
                  }
                >
                  <option value="auto">По текущему шагу</option>
                  <option value="all">Все бакеты</option>
                  {groups.map((i) => (
                    <option value={i} key={i}>
                      Перенос [{i}] → [{i}], [{i + graph.oldCapacity}]
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="subtle-button"
                aria-expanded={tablesOpen}
                onClick={() => setTablesOpen((v) => !v)}
              >
                {tablesOpen ? "Скрыть массив" : "Массив новой таблицы"}
              </button>
            </div>
            <div className="resize-progress">
              {graph.transferObjects > 0
                ? `Временные объекты: ${graph.transferObjects} · вне табличных цепочек; перенос ещё выполняется`
                : "Старые бакеты сохраняют записи до переноса"}
              {group !== null && (
                <span>
                  {" "}
                  · фокус [{group}] · остальные области доступны в «Все бакеты»
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="array-heading">
            <code>
              {graph.starting
                ? "Старая table · resize начинается"
                : "Node<K, V>[] table"}
            </code>
            <label className="check-label">
              <input
                type="checkbox"
                checked={hideEmpty}
                onChange={(e) => setHideEmpty(e.target.checked)}
              />{" "}
              Скрыть пустые
            </label>
          </div>
        )}
        {(!graph.expanding || tablesOpen) &&
          (state.capacity > 0 ? (
            <>
              <div
                className="bucket-array"
                role="region"
                tabIndex={0}
                aria-label="Массив бакетов"
              >
                {indexList.map((i) => (
                  <button
                    key={i}
                    title={`Бакет ${i}: ${occupied.get(i)?.kind ?? "пустой"}`}
                    className={`bucket-cell ${occupied.has(i) ? "occupied" : ""} ${activeBucket === i || focusedBucket === i ? "active" : ""}`}
                    onClick={() => {
                      setFocusedBucket(i === focusedBucket ? null : i);
                      if (graph.expanding) focusOn(i % graph.oldCapacity);
                      const target =
                        occupied.get(i)?.rootId ?? occupied.get(i)?.headId;
                      if (target !== undefined && target !== null) {
                        pendingCenter.current = target;
                        if (positions.has(target)) centerOn(target);
                      }
                    }}
                  >
                    <span className="bucket-index">
                      {String(i).padStart(2, "0")}
                    </span>
                    <span>
                      {occupied.has(i)
                        ? occupied.get(i)!.kind === "TREE"
                          ? "T"
                          : occupied.get(i)!.nodes.filter((n) => n.linked)
                              .length
                        : "·"}
                    </span>
                  </button>
                ))}
              </div>
              {!graph.expanding && (
                <div className="array-caption">
                  {state.capacity} бакетов · {state.buckets.length} занято{" "}
                  {hideEmpty &&
                    `· ${state.capacity - state.buckets.length} пустых скрыто`}
                  {focusedBucket !== null && focusedBucket < state.capacity && (
                    <span>
                      {" "}
                      · [{focusedBucket}]{" "}
                      {occupied.get(focusedBucket)?.kind ??
                        "null — пустой бакет"}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="unallocated">
              <code>table = null</code>
              <span>Массив будет выделен при первом put.</span>
            </div>
          ))}
        {step?.event === "BUCKET_SPLIT" && (
          <div className="split-explanation">
            <span>SPLIT</span> <code>{String(step.details.formula)}</code>
            <span>
              bucket [{String(step.details.fromBucket)}] → [
              {String(step.details.toBucket)}]
            </span>
          </div>
        )}
      </div>
      <div className="diagram-navigation">
        <label className="check-label">
          <input
            type="checkbox"
            checked={physical}
            onChange={(e) => {
              setPhysical(e.target.checked);
              setRelationship(undefined);
            }}
          />{" "}
          Физические связи
        </label>
        {group !== null && (
          <button className="subtle-button" onClick={() => focusOn("all")}>
            Все бакеты
          </button>
        )}
        {selected && (
          <button
            className="icon-button"
            onClick={() => reveal(selected.objectId)}
          >
            К выбранному узлу
          </button>
        )}
        {!selected && !graph.expanding && (
          <span className="navigation-hint">Нажмите на бакет или узел</span>
        )}
      </div>
      {physical && (
        <div className="physical-tools">
          <span>
            {graph.nodes.size} физических объектов · {graph.unlinked} вне
            цепочек
          </span>
          {selected && outgoing.length > 0 && (
            <label>
              Ссылка{" "}
              <select
                aria-label="Физическая связь"
                value={
                  selectedEdge?.from === selected.objectId
                    ? selectedEdge.id
                    : ""
                }
                onChange={(e) => {
                  const edge = graph.edges.find((v) => v.id === e.target.value);
                  if (edge) chooseEdge(edge);
                }}
              >
                <option value="">Выберите поле obj {selected.objectId}</option>
                {outgoing.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.field} → obj {e.to}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selectedEdge && (
            <div className="relationship-info" role="status">
              <code>
                {selectedEdge.from === null
                  ? selectedEdge.areaId
                  : `obj ${selectedEdge.from}`}{" "}
                · {selectedEdge.field} → obj {selectedEdge.to}
              </code>
              {selectedEdge.from !== null && (
                <button
                  className="subtle-button"
                  onClick={() => reveal(selectedEdge.from!)}
                >
                  К источнику
                </button>
              )}
              <button
                className="subtle-button"
                onClick={() => reveal(selectedEdge.to)}
              >
                К цели
              </button>
            </div>
          )}
        </div>
      )}
      <div
        className="diagram-scroll"
        data-testid="diagram"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Прокручиваемая схема HashMap"
      >
        {layout.nodes.length === 0 && (
          <div className="empty-diagram">
            <div className="empty-icon">
              <Boxes size={32} strokeWidth={1.3} />
            </div>
            <h3>
              {state.capacity
                ? "Все бакеты пусты"
                : "Всё начинается с первого ключа"}
            </h3>
            <p>
              Выполните <code>put</code> или выберите готовый сценарий.
              <br />
              Каждый переход здесь выполняет Java-движок.
            </p>
          </div>
        )}
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
          {layout.edges.map((edge) => {
            const geometry = edgeGeometry(edge, positions, layout, cameraWidth);
            if (!geometry) return null;
            const active = selectedEdge?.id === edge.id;
            return (
              <g
                key={edge.id}
                data-edge={edge.id}
                className={`physical-edge ${active ? "selected" : ""} ${edge.tree || edge.field === "next" ? "structural" : "secondary"}`}
              >
                <path d={geometry.path} markerEnd="url(#arrow)" />
                {physical && (
                  <path
                    d={geometry.path}
                    className="edge-hit"
                    role="button"
                    tabIndex={0}
                    aria-label={`${edge.from === null ? edge.areaId : `obj ${edge.from}`} ${edge.field} → obj ${edge.to}${geometry.external ? ", вне фокуса" : ""}`}
                    onClick={() => chooseEdge(edge)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        chooseEdge(edge);
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
                <title>
                  {edge.from === null ? edge.areaId : `obj ${edge.from}`} ·{" "}
                  {edge.field} → obj {edge.to}
                </title>
              </g>
            );
          })}
          {layout.nodes.map(({ node, x, y, pending, areaId }) => (
            <g
              key={node.objectId}
              transform={`translate(${x} ${y})`}
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
              style={{ cursor: "pointer" }}
              opacity={
                pending &&
                selected?.objectId !== node.objectId &&
                selectedEdge?.from !== node.objectId &&
                selectedEdge?.to !== node.objectId
                  ? 0.8
                  : 1
              }
            >
              <title>{`${keyLabel(node.key)} → ${valueLabel(node.value)}\nid: ${node.id}; objectId: ${node.objectId}\nparent=${node.parent}; left=${node.left}; right=${node.right}; next=${node.next}; prev=${node.prev}`}</title>
              <rect
                width="116"
                height="65"
                rx="9"
                strokeDasharray={!node.linked ? "4 3" : undefined}
                className={`map-node ${step?.details.nodeObjectId === node.objectId || selected?.objectId === node.objectId || selectedEdge?.from === node.objectId || selectedEdge?.to === node.objectId ? "highlighted" : ""} ${node.red === true ? "red-node" : node.red === false ? "black-node" : ""}`}
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
          ))}
        </svg>
      </div>
      <div className="diagram-legend">
        <span>
          <i className="legend-list" /> Узел списка
        </span>
        <span>
          <i className="legend-red" /> R · Красный
        </span>
        <span>
          <i className="legend-black" /> B · Чёрный
        </span>
        <span className="legend-hint">
          Нажмите на узел, чтобы изучить ссылки
        </span>
      </div>
    </section>
  );
}

export function edgeGeometry(
  edge: Edge,
  positions: Map<number, PlacedNode>,
  layout: DiagramLayout,
  width: number,
) {
  const from = edge.from === null ? undefined : positions.get(edge.from),
    to = positions.get(edge.to);
  const band = edge.areaId
    ? layout.bands.find((b) => b.id === edge.areaId)
    : undefined;
  if (!from && !band) return;
  const cross =
    !to || (from ? from.areaId !== to.areaId : band?.id !== to.areaId);
  const x1 = from
    ? from.x + (edge.tree ? 58 : edge.field === "parent" ? 58 : 116)
    : 112;
  const y1 = from
    ? from.y + (edge.tree ? 65 : edge.field === "parent" ? 0 : 32)
    : band!.y + (edge.field === "head" ? 64 : 85);
  const x2 = to
    ? to.x + (edge.tree || edge.field === "parent" ? 58 : 0)
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
function short(value: string, length: number) {
  return value.length > length ? value.slice(0, length - 1) + "…" : value;
}
