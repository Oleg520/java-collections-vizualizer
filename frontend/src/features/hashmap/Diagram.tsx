import { objectId, resolveSelection, type NodeSelection } from "./identity";
import { keyLabel } from "./presentation";
import { valueLabel } from "./presentation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Boxes, Maximize, Minus, Plus, ScanLine } from "lucide-react";
import { layoutSnapshot } from "./layout";
import { type MapNode, type Snapshot, type Step } from "../../api/types/index";

export function Diagram({
  state,
  step,
  onSelect,
  selectedId,
}: {
  state: Snapshot;
  step?: Step;
  onSelect: (node: MapNode) => void;
  selectedId?: NodeSelection;
}) {
  const layout = useMemo(() => layoutSnapshot(state), [state]);
  const [zoom, setZoom] = useState<number | "fit" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const fitScale = Math.min(1, viewportWidth / layout.width);
  const scale = zoom === "fit" ? fitScale : (zoom ?? (mobile ? 1 : fitScale));
  const centerOn = (x: number, y: number) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      left: (x + 58) * scale - element.clientWidth / 2,
      top: (y + 32) * scale + 8 - element.clientHeight / 2,
      behavior: "instant",
    });
  };
  const [hideEmpty, setHideEmpty] = useState(false);
  const [focusedBucket, setFocusedBucket] = useState<number | null>(null);
  useEffect(() => {
    setFocusedBucket((index) =>
      index !== null && index >= state.capacity ? null : index,
    );
  }, [state.capacity]);
  const reduced = useReducedMotion();
  const transition = {
    duration: reduced ? 0 : 0.3,
    ease: "easeInOut" as const,
  };
  const positions = new Map(layout.nodes.map((n) => [objectId(n.node), n]));
  const occupied = new Map(state.buckets.map((b) => [b.index, b]));
  const activeBucket =
    typeof step?.details.bucketIndex === "number"
      ? step.details.bucketIndex
      : typeof step?.details.toBucket === "number"
        ? step.details.toBucket
        : null;
  const activeNode = step?.details.nodeObjectId;
  const selected = resolveSelection(state, selectedId);
  const selectedObjectId = selected && objectId(selected);
  const indexList = hideEmpty
    ? state.buckets.map((b) => b.index)
    : Array.from({ length: state.capacity }, (_, i) => i);
  return (
    <section className="visualization panel" aria-label="Визуализация HashMap">
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
            onClick={() => setZoom(Math.max(0.01, scale - 0.15))}
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
            onClick={() => {
              setZoom(null);
              setFocusedBucket(null);
              scrollRef.current?.scrollTo({
                left: 0,
                top: 0,
                behavior: "instant",
              });
            }}
          >
            <ScanLine size={15} />
          </button>
        </div>
      </div>
      <div className="bucket-overview">
        <div className="array-heading">
          <code>Node&lt;K, V&gt;[] table</code>
          <label className="check-label">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={(e) => setHideEmpty(e.target.checked)}
            />{" "}
            Скрыть пустые
          </label>
        </div>
        {state.capacity > 0 ? (
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
                    const bucket = occupied.get(i);
                    const target = layout.nodes.find(
                      (n) =>
                        n.bucket === i &&
                        !n.pending &&
                        (bucket?.rootId == null ||
                          objectId(n.node) === bucket.rootId),
                    );
                    if (target) centerOn(target.x, target.y);
                  }}
                >
                  <span className="bucket-index">
                    {String(i).padStart(2, "0")}
                  </span>
                  <span>
                    {occupied.has(i)
                      ? occupied.get(i)!.kind === "TREE"
                        ? "T"
                        : occupied.get(i)!.nodes.filter((n) => n.linked).length
                      : "·"}
                  </span>
                </button>
              ))}
            </div>
            <div className="array-caption">
              {state.capacity} бакетов · {state.buckets.length} занято{" "}
              {hideEmpty &&
                `· ${state.capacity - state.buckets.length} пустых скрыто`}
              {focusedBucket !== null && (
                <span>
                  {" "}
                  · [{focusedBucket}]{" "}
                  {occupied.has(focusedBucket)
                    ? occupied.get(focusedBucket)!.kind
                    : "null — пустой бакет"}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="unallocated">
            <code>table = null</code>
            <span>Массив будет выделен при первом put.</span>
          </div>
        )}
        {step?.event === "BUCKET_SPLIT" && (
          <div className="split-explanation">
            <span className="pulse-dot" /> SPLIT{" "}
            <code>{String(step.details.formula)}</code>
            <span>
              bucket [{String(step.details.fromBucket)}] → [
              {String(step.details.toBucket)}]
            </span>
          </div>
        )}
      </div>
      <div className="diagram-navigation">
        <span>Прокрутите схему · нажмите на бакет, чтобы перейти к узлам</span>
        {selectedObjectId !== undefined && positions.has(selectedObjectId) && (
          <button
            className="icon-button"
            onClick={() => {
              const node = positions.get(selectedObjectId)!;
              centerOn(node.x, node.y);
            }}
          >
            К выбранному узлу
          </button>
        )}
      </div>
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
            <div className="empty-flow">
              <span>key</span>
              <i>→</i>
              <span>hash</span>
              <i>→</i>
              <span>bucket</span>
              <i>→</i>
              <span>node</span>
            </div>
          </div>
        )}
        <svg
          width={layout.width * scale}
          height={layout.height * scale}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
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
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6d8b7b" />
            </marker>
          </defs>
          {layout.bands.map((b) => (
            <g
              key={b.id}
              opacity={
                focusedBucket !== null && focusedBucket !== b.index ? 0.25 : 1
              }
            >
              <rect
                x="14"
                y={b.y}
                width={layout.width - 28}
                height={b.height}
                rx="12"
                className={b.pending ? "band pending" : "band"}
              />
              <text x="30" y={b.y + 30} className="svg-bucket">
                {b.pending ? "old " : ""}[{b.index}]
              </text>
              <text x="30" y={b.y + 49} className="svg-kind">
                {b.kind === "TREE"
                  ? "RB TREE"
                  : b.kind === "TRANSFER"
                    ? "IN TRANSIT"
                    : "LINKED LIST"}
              </text>
            </g>
          ))}
          <AnimatePresence>
            {layout.edges.map((edge) => {
              const from = positions.get(edge.from),
                to = positions.get(edge.to);
              if (!from || !to) return null;
              const x1 = from.x + (edge.tree ? 58 : 116),
                y1 = from.y + (edge.tree ? 65 : 32),
                x2 = to.x + (edge.tree ? 58 : 0),
                y2 = to.y + (edge.tree ? 0 : 32);
              return (
                <motion.g
                  key={edge.id}
                  data-edge={edge.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <motion.line
                    initial={false}
                    animate={{ x1, y1, x2, y2 }}
                    transition={transition}
                    stroke="#5b7869"
                    strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                  />
                  <motion.text
                    initial={false}
                    animate={{
                      x: (x1 + x2) / 2 + (edge.tree ? 6 : -9),
                      y: (y1 + y2) / 2 - 6,
                    }}
                    className="svg-edge-label"
                    transition={transition}
                  >
                    {edge.label}
                  </motion.text>
                </motion.g>
              );
            })}
            {layout.nodes.map(({ node, x, y, bucket, pending }) => {
              const active =
                activeNode === objectId(node) ||
                selectedObjectId === objectId(node);
              return (
                <motion.g
                  key={objectId(node)}
                  initial={{ opacity: 0, x, y: y - 12, scale: 0.9 }}
                  animate={{
                    x,
                    y,
                    opacity:
                      focusedBucket !== null && focusedBucket !== bucket
                        ? 0.25
                        : pending
                          ? 0.6
                          : 1,
                    scale: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={transition}
                  data-object-id={objectId(node)}
                  data-entry-id={node.id}
                  data-linked={node.linked}
                  role="button"
                  tabIndex={0}
                  aria-label={`Узел ${keyLabel(node.key)}, ${node.red === null ? "список" : node.red ? "красный" : "чёрный"}`}
                  onClick={() => onSelect(node)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(node);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${keyLabel(node.key)} → ${valueLabel(node.value)}\nID: ${node.id}; objectId: ${objectId(node)}; hashCode: ${node.rawHashCode}; hash: ${node.hash}\nparent=${node.parent}; left=${node.left}; right=${node.right}; next=${node.next}; prev=${node.prev}`}</title>
                  <rect
                    width="116"
                    height="65"
                    rx="9"
                    strokeDasharray={!node.linked ? "4 3" : undefined}
                    className={`map-node ${active ? "highlighted" : ""} ${node.red === true ? "red-node" : node.red === false ? "black-node" : ""}`}
                  />
                  <line
                    x1="0"
                    y1="35"
                    x2="116"
                    y2="35"
                    stroke={node.red === true ? "#704044" : "#35483c"}
                  />
                  {node.red !== null && (
                    <circle
                      cx="103"
                      cy="12"
                      r="4"
                      fill={node.red ? "#f7898c" : "#0d1310"}
                      stroke={node.red ? "#f7898c" : "#a4b5ab"}
                    />
                  )}
                  <text x="12" y="23" className="svg-key">
                    {short(keyLabel(node.key), 12)}
                  </text>
                  <text x="12" y="54" className="svg-value">
                    {short(valueLabel(node.value), 13)}
                  </text>
                  <text
                    x="57"
                    y="81"
                    textAnchor="middle"
                    className="svg-node-id"
                  >
                    #{node.id} · obj {objectId(node)}
                  </text>
                  {!node.linked && (
                    <text
                      x="57"
                      y="95"
                      textAnchor="middle"
                      className="svg-node-id"
                    >
                      вне цепочки
                    </text>
                  )}
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>
      </div>
      <div className="diagram-legend">
        <span>
          <i className="legend-list" /> Узел списка
        </span>
        <span>
          <i className="legend-red" /> Красный
        </span>
        <span>
          <i className="legend-black" /> Чёрный
        </span>
        <span className="legend-hint">
          Нажмите на узел, чтобы изучить ссылки
        </span>
      </div>
    </section>
  );
}
function short(value: string, length: number) {
  return value.length > length ? value.slice(0, length - 1) + "…" : value;
}
