import { resolveSelection, type NodeSelection } from "./identity";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Boxes, Maximize, Minus, Plus, ScanLine } from "lucide-react";
import { layoutSnapshot } from "./layout";
import { snapshotGraph, type Edge } from "./graph";
import { HashMapGraph } from "./HashMapGraph";
import type { PlaybackNavigation } from "../../playback/useTracePlayback";
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
  cursor = 0,
  navigation = "seek",
  speed = 1,
  playing = false,
  onSelect,
  selectedId,
}: {
  state: Snapshot;
  step?: Step;
  trace?: Trace;
  cursor?: number;
  navigation?: PlaybackNavigation;
  speed?: number;
  playing?: boolean;
  onSelect: (node: MapNode) => void;
  selectedId?: NodeSelection;
}) {
  const graph = useMemo(() => snapshotGraph(state, step), [state, step]);
  const bounds = useMemo(() => traceLayoutBounds(trace), [trace]);
  const selected = resolveSelection(state, selectedId);
  const [focus, setFocus] = useState<{
    trace?: Trace;
    cursor?: number;
    navigation?: PlaybackNavigation;
    speed?: number;
    playing?: boolean;
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
        <HashMapGraph
          layout={layout}
          graph={graph}
          cameraWidth={cameraWidth}
          scale={scale}
          physical={physical}
          selected={selected}
          selectedEdge={selectedEdge}
          step={step}
          onSelect={onSelect}
          onEdge={chooseEdge}
          trace={trace}
          cursor={cursor}
          navigation={navigation}
          speed={speed}
          playing={playing}
          view={`${group ?? "all"}:${physical}:${scale}`}
        />
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
