import { useI18n } from "../../i18n/LocaleProvider";
import { resolveSelection, type NodeSelection } from "./identity";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Boxes, Maximize, Minus, Plus, ScanLine } from "lucide-react";
import { layoutSnapshot } from "./layout";
import { snapshotGraph, type Edge } from "./graph";
import { HashMapGraph } from "./HashMapGraph";
import type { PlaybackNavigation } from "../../playback/useTracePlayback";
import { traceLayoutBounds, resizeGroupingCapacity } from "./traceLayout";
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
  const { t } = useI18n();
  const groupingCapacity =
    resizeGroupingCapacity(trace, cursor) || state.pendingCapacity;
  const graph = useMemo(
    () => snapshotGraph(state, step, groupingCapacity),
    [state, step, groupingCapacity],
  );
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
  const cameraWidth = layout.width;
  const fitWidth =
    bounds.size === 0
      ? layout.width
      : Math.max(
          650,
          ...(group === null
            ? [...new Set(layout.bands.map((b) => b.group))].map(
                (g) =>
                  bounds.get(g)?.treeWidth ??
                  bounds.get(g)?.width ??
                  layout.width,
              )
            : [
                bounds.get(group)?.treeWidth ??
                  bounds.get(group)?.width ??
                  layout.width,
              ]),
        );
  const [fitReference, setFitReference] = useState<{
    trace?: Trace;
    width: number;
  }>();
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
  const fitScale = Math.min(
    1,
    viewportWidth /
      (zoom === "fit" && fitReference && fitReference.trace === trace
        ? fitReference.width
        : fitWidth),
  );
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
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "instant" });
  }, [trace, group]);
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
  useEffect(() => {
    setFocusedBucket((index) =>
      index !== null && index >= state.capacity ? null : index,
    );
  }, [state.capacity]);
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
      className={`visualization panel hashmap-diagram ${physical ? "has-physical" : ""} ${graph.expanding ? "is-resizing" : ""}`}
      aria-label={t("hashmap.Diagram.hashmap_visualization")}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("memoryView")}</span>
          <h2>
            {t("hashmap.Diagram.inside_hashmap")}{" "}
            <span className="small-tag">Java 21</span>
          </h2>
        </div>
        <div className="zoom-controls">
          <button
            className="icon-button"
            aria-label={t("hashmap.Diagram.zoom_out")}
            onClick={() => setZoom(Math.max(0.1, scale - 0.15))}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            className="icon-button"
            aria-label={t("hashmap.Diagram.zoom_100")}
            onClick={() => setZoom(1)}
          >
            <code>1:1</code>
          </button>
          <button
            className="icon-button"
            aria-label={t("hashmap.Diagram.zoom_in")}
            onClick={() => setZoom(Math.min(1.6, scale + 0.15))}
          >
            <Plus size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={t("hashmap.Diagram.fit_to_width")}
            title={t("hashmap.Diagram.fit_to_width")}
            onClick={() => {
              setFitReference({ trace, width: cameraWidth });
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
            aria-label={t("hashmap.Diagram.reset_zoom")}
            onClick={resetZoom}
          >
            <ScanLine size={15} />
          </button>
        </div>
      </div>
      <div className="bucket-overview">
        {graph.expanding ? (
          <div className="resize-overview">
            <div
              className="resize-counts"
              aria-label={t("hashmap.Diagram.transfer_state")}
            >
              <strong>Map: {t("entryCount", { count: state.size })}</strong>
              <span>
                {t("hashmap.Diagram.new_table")}{" "}
                <b>
                  {state.buckets.length}/{state.capacity}
                </b>{" "}
                {t("hashmap.Diagram.occupied")}
              </span>
              <span>
                {t("hashmap.Diagram.old_table")}{" "}
                <b>
                  {graph.oldOccupied}/{graph.oldCapacity}
                </b>{" "}
                {t("hashmap.Diagram.awaiting_transfer")}
              </span>
            </div>
            <div className="resize-focus">
              <label>
                {t("hashmap.Diagram.show")}{" "}
                <select
                  aria-label={t("hashmap.Diagram.transfer_focus")}
                  value={focusChoice}
                  onChange={(e) =>
                    focusOn(
                      e.target.value === "auto" || e.target.value === "all"
                        ? e.target.value
                        : Number(e.target.value),
                    )
                  }
                >
                  <option value="auto">
                    {t("hashmap.Diagram.follow_current_step")}
                  </option>
                  <option value="all">
                    {t("hashmap.Diagram.all_buckets")}
                  </option>
                  {groups.map((i) => (
                    <option value={i} key={i}>
                      {t("hashmap.Diagram.transfer")}
                      {i}] → [{i}], [{i + graph.oldCapacity}]
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="subtle-button"
                aria-expanded={tablesOpen}
                onClick={() => setTablesOpen((v) => !v)}
              >
                {tablesOpen
                  ? t("hashmap.Diagram.hide_array")
                  : t("hashmap.Diagram.new_table_array")}
              </button>
            </div>
            <div className="resize-progress">
              {graph.transferObjects > 0
                ? t("hashmap.Diagram.temporary_objects_outside_table_chains", {
                    "0": graph.transferObjects,
                  })
                : t(
                    "hashmap.Diagram.old_buckets_retain_entries_until_transfer",
                  )}
              {group !== null && (
                <span>
                  {" "}
                  {t("hashmap.Diagram.focus")}
                  {group}]
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="array-heading">
            <code>
              {graph.starting
                ? t("hashmap.Diagram.old_table_resize_begins")
                : "Node<K, V>[] table"}
            </code>
            <label className="check-label">
              <input
                type="checkbox"
                checked={hideEmpty}
                onChange={(e) => setHideEmpty(e.target.checked)}
              />{" "}
              {t("hashmap.Diagram.hide_empty")}
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
                aria-label={t("hashmap.Diagram.bucket_array")}
              >
                {indexList.map((i) => (
                  <button
                    key={i}
                    title={t("hashmap.Diagram.bucket", {
                      "0": i,
                      "1": occupied.get(i)?.kind ?? t("emptyBucket"),
                    })}
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
                  {state.capacity} {t("hashmap.Diagram.buckets")}{" "}
                  {state.buckets.length}
                  {t("hashmap.Diagram.occupied")}{" "}
                  {hideEmpty &&
                    t("hashmap.Diagram.empty_hidden", {
                      "0": state.capacity - state.buckets.length,
                    })}
                  {focusedBucket !== null && focusedBucket < state.capacity && (
                    <span>
                      {" "}
                      · [{focusedBucket}]{" "}
                      {occupied.get(focusedBucket)?.kind ??
                        t("hashmap.Diagram.null_empty_bucket")}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="unallocated">
              <code>table = null</code>
              <span>{t("hashmap.Diagram.the_array_is_allocated_on_the")}</span>
            </div>
          ))}
        {step?.event === "BUCKET_SPLIT" && (
          <div className="split-explanation">
            <span>{t("splitLabel")}</span>{" "}
            <code>{String(step.details.formula)}</code>
            <span>
              {t("bucketLabel")} [{String(step.details.fromBucket)}] → [
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
          {t("hashmap.Diagram.physical_links")}
        </label>
        {group !== null && (
          <button className="subtle-button" onClick={() => focusOn("all")}>
            {t("hashmap.Diagram.all_buckets")}
          </button>
        )}
        {selected && (
          <button
            className="icon-button"
            onClick={() => reveal(selected.objectId)}
          >
            {t("hashmap.Diagram.go_to_selected_node")}
          </button>
        )}
        {!selected && !graph.expanding && (
          <span className="navigation-hint">
            {t("hashmap.Diagram.click_a_bucket_or_node")}
          </span>
        )}
      </div>
      {physical && (
        <div className="physical-tools">
          <span>
            {graph.nodes.size} {t("hashmap.Diagram.physical_objects")}{" "}
            {graph.unlinked} {t("hashmap.Diagram.outside_chains")}
          </span>
          {selected && outgoing.length > 0 && (
            <label>
              {t("hashmap.Diagram.link")}{" "}
              <select
                aria-label={t("hashmap.Diagram.physical_link")}
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
                <option value="">
                  {t("hashmap.Diagram.select_a_field_of_obj")}{" "}
                  {selected.objectId}
                </option>
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
                  {t("hashmap.Diagram.go_to_source")}
                </button>
              )}
              <button
                className="subtle-button"
                onClick={() => reveal(selectedEdge.to)}
              >
                {t("hashmap.Diagram.go_to_target")}
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
        aria-label={t("hashmap.Diagram.scrollable_hashmap_diagram")}
      >
        {layout.nodes.length === 0 && (
          <div className="empty-diagram">
            <div className="empty-icon">
              <Boxes size={32} strokeWidth={1.3} />
            </div>
            <h3>
              {state.capacity
                ? t("hashmap.Diagram.all_buckets_are_empty")
                : t("hashmap.Diagram.it_starts_with_the_first_key")}
            </h3>
            <p>
              {t("hashmap.Diagram.execute")} <code>put</code>{" "}
              {t("hashmap.Diagram.or_choose_a_ready_made_scenario")}
              <br />
              {t("hashmap.Diagram.the_java_engine_performs_every_transition")}
            </p>
          </div>
        )}
        <HashMapGraph
          focusedBucket={graph.expanding ? null : focusedBucket}
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
          <i className="legend-list" /> {t("hashmap.Diagram.list_node")}
        </span>
        <span>
          <i className="legend-red" /> {t("hashmap.Diagram.r_red")}
        </span>
        <span>
          <i className="legend-black" /> {t("hashmap.Diagram.b_black")}
        </span>
        <span className="legend-hint">
          {t("hashmap.Diagram.click_a_node_to_explore_its")}
        </span>
      </div>
    </section>
  );
}
