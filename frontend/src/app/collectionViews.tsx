import type { Message } from "../i18n/errors";
import { russian, type Translator } from "../i18n/locale";
import { objectId, type NodeSelection } from "../features/hashmap/identity";
import type { ComponentType, ReactNode } from "react";
import {
  isArray,
  type CollectionType,
  type CollectionSnapshot,
  type Operation,
  type Session,
  type Step,
  type Trace,
} from "../api/types";
import { CommandPanel } from "../features/hashmap/CommandPanel";
import { Diagram } from "../features/hashmap/Diagram";
import { selectedDetails } from "../features/hashmap/NodeDetails";
import * as hashmap from "../features/hashmap/presentation";
import { ArrayCommandPanel } from "../features/arraylist/ArrayCommandPanel";
import { ArrayDiagram } from "../features/arraylist/ArrayDiagram";
import * as arraylist from "../features/arraylist/presentation";

import type { PlaybackNavigation } from "../playback/useTracePlayback";

type CommandsProps = {
  metrics: ReactNode;
  busy: boolean;
  blocked?: boolean;
  session: Session | null;
  onCommand: (operation: Operation) => void;
  onError: (message: Message) => void;
  onCreate: (capacity?: number) => void;
};
type DiagramProps = {
  snapshot: CollectionSnapshot;
  step?: Step;
  selectedId?: NodeSelection;
  playing?: boolean;
  trace?: Trace;
  cursor?: number;
  speed?: number;
  navigation?: PlaybackNavigation;
  onSelect: (id: NodeSelection | undefined) => void;
};
interface CollectionView {
  name: string;
  family: string;
  description: (t?: Translator) => string;
  sourceUrl: string;
  algorithm: (t?: Translator) => string[][];
  metrics: (
    snapshot?: CollectionSnapshot,
    t?: Translator,
  ) => { label: string; value: string | number; caption: string }[] | undefined;
  resultText: (trace: Trace, t?: Translator) => string;
  resultCaption: (trace: Trace, t?: Translator) => string;
  idleCaption: (t?: Translator) => string;
  Commands: ComponentType<CommandsProps>;
  Diagram: ComponentType<DiagramProps>;
  selectedDetails: (
    snapshot: CollectionSnapshot | undefined,
    id: NodeSelection | undefined,
    close: () => void,
    onSelect?: (selection: NodeSelection) => void,
    t?: Translator,
  ) => { title: string; content: ReactNode } | undefined;
}

export const collectionViews: Record<CollectionType, CollectionView> = {
  HASH_MAP: {
    name: "HashMap",
    family: "Map",
    description: (t = russian) =>
      t("collectionViews.add_keys_follow_links_explore_the"),
    sourceUrl:
      "https://github.com/openjdk/jdk21u/blob/3f3a1f534b7f2f5be6d7ded9d9832fa9394e763c/src/java.base/share/classes/java/util/HashMap.java",
    algorithm: hashmap.algorithm,
    // HashMap owns the existing loading placeholders and its untagged wire snapshot.
    metrics: (snapshot, t = russian) =>
      snapshot === undefined ||
      (!("collection" in snapshot) && "buckets" in snapshot)
        ? hashmap.metrics(snapshot, t)
        : undefined,
    resultText: hashmap.resultText,
    resultCaption: (trace, t = russian) =>
      trace.result.found
        ? t("collectionViews.key_found_in_the_collection")
        : t("collectionViews.operation_executed_by_the_java_engine"),
    idleCaption: (t = russian) =>
      t("collectionViews.start_with_put_or_a_scenario"),
    Commands: CommandPanel,
    Diagram: ({
      snapshot,
      step,
      trace,
      selectedId,
      onSelect,
      cursor,
      speed,
      navigation,
      playing,
    }) =>
      isArray(snapshot) ? null : (
        <Diagram
          state={snapshot}
          trace={trace}
          cursor={cursor}
          speed={speed}
          navigation={navigation}
          playing={playing}
          step={step}
          selectedId={selectedId}
          onSelect={(node) =>
            onSelect(
              objectId(node) === selectedId?.preferredObjectId
                ? undefined
                : { logicalId: node.id, preferredObjectId: objectId(node) },
            )
          }
        />
      ),
    selectedDetails,
  },
  ARRAY_LIST: {
    name: "ArrayList",
    family: "List",
    description: (t = russian) =>
      t("collectionViews.add_elements_explore_indices_shifts_and"),
    sourceUrl:
      "https://github.com/openjdk/jdk21u/blob/jdk-21.0.5%2B11/src/java.base/share/classes/java/util/ArrayList.java",
    algorithm: arraylist.algorithm,
    metrics: (snapshot, t = russian) =>
      snapshot && isArray(snapshot)
        ? arraylist.metrics(snapshot, t)
        : undefined,
    resultText: arraylist.resultText,
    resultCaption: (_trace, t = russian) =>
      t("collectionViews.operation_executed_by_the_java_engine"),
    idleCaption: (t = russian) =>
      t("collectionViews.start_with_add_or_a_scenario"),
    Commands: ArrayCommandPanel,
    Diagram: ({ snapshot, step, playing }) =>
      isArray(snapshot) ? (
        <ArrayDiagram state={snapshot} step={step} playing={playing} />
      ) : null,
    selectedDetails: () => undefined,
  },
};

export const collectionOptions = (
  Object.keys(collectionViews) as CollectionType[]
).map((id, index) => ({
  id,
  name: collectionViews[id].name,
  number: String(index + 1).padStart(2, "0"),
}));

/** Presentation follows the displayed snapshot and trace, including history and loading placeholders. */
export function statePresentation(
  snapshot?: CollectionSnapshot,
  trace?: Trace,
  cursor?: number,
  t: Translator = russian,
) {
  const state = Object.values(collectionViews)
    .map((view) => ({ view, metrics: view.metrics(snapshot, t) }))
    .find(({ metrics }) => metrics !== undefined);
  if (!state || !state.metrics)
    throw new Error(t("collectionViews.unknown_snapshot_type"));

  let result = "—";
  let resultCaption = state.view.idleCaption(t);
  if (trace) {
    const view = Object.entries(collectionViews).find(
      ([id]) => id === trace.collection,
    )?.[1];
    if (!view) throw new Error(t("collectionViews.unknown_trace_collection"));
    // A scenario may contain earlier OPERATION_COMPLETED/COMMITTED frames.
    // Only the last frame of this trace makes its final Java result visible.
    if (
      cursor !== undefined &&
      cursor >= 0 &&
      cursor === trace.steps.length - 1
    ) {
      result = view.resultText(trace, t);
      resultCaption = view.resultCaption(trace, t);
    } else {
      resultCaption = t("collectionViews.the_result_appears_when_the_trace");
    }
  }
  return { metrics: state.metrics, result, resultCaption };
}
