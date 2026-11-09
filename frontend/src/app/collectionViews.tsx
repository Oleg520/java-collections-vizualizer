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

type CommandsProps = {
  busy: boolean;
  session: Session | null;
  onCommand: (operation: Operation) => void;
  onError: (message: string) => void;
  onCreate: (capacity?: number) => void;
};
type DiagramProps = {
  snapshot: CollectionSnapshot;
  step?: Step;
  selectedId?: number;
  onSelect: (id: number | undefined) => void;
};
interface CollectionView {
  name: string;
  family: string;
  description: string;
  sourceUrl: string;
  algorithm: string[][];
  metrics: (
    snapshot?: CollectionSnapshot,
  ) => { label: string; value: string | number; caption: string }[] | undefined;
  resultText: (trace: Trace) => string;
  resultCaption: (trace: Trace) => string;
  idleCaption: string;
  Commands: ComponentType<CommandsProps>;
  Diagram: ComponentType<DiagramProps>;
  selectedDetails: (
    snapshot: CollectionSnapshot | undefined,
    id: number | undefined,
    close: () => void,
  ) => { title: string; content: ReactNode } | undefined;
}

export const collectionViews: Record<CollectionType, CollectionView> = {
  HASH_MAP: {
    name: "HashMap",
    family: "Map",
    description: "Добавляйте ключи. Следите за связями. Исследуйте алгоритм.",
    sourceUrl:
      "https://github.com/openjdk/jdk21u/blob/3f3a1f534b7f2f5be6d7ded9d9832fa9394e763c/src/java.base/share/classes/java/util/HashMap.java",
    algorithm: hashmap.algorithm,
    // HashMap owns the existing loading placeholders and its untagged wire snapshot.
    metrics: (snapshot) =>
      snapshot === undefined ||
      (!("collection" in snapshot) && "buckets" in snapshot)
        ? hashmap.metrics(snapshot)
        : undefined,
    resultText: hashmap.resultText,
    resultCaption: (trace) =>
      trace.result.found
        ? "ключ найден в коллекции"
        : "операция выполнена Java-движком",
    idleCaption: "начните с put или сценария",
    Commands: CommandPanel,
    Diagram: ({ snapshot, step, selectedId, onSelect }) =>
      isArray(snapshot) ? null : (
        <Diagram
          state={snapshot}
          step={step}
          selectedId={selectedId}
          onSelect={(node) =>
            onSelect(node.id === selectedId ? undefined : node.id)
          }
        />
      ),
    selectedDetails,
  },
  ARRAY_LIST: {
    name: "ArrayList",
    family: "List",
    description:
      "Добавляйте элементы. Следите за индексами, сдвигами и ростом массива.",
    sourceUrl:
      "https://github.com/openjdk/jdk21u/blob/jdk-21.0.5%2B11/src/java.base/share/classes/java/util/ArrayList.java",
    algorithm: arraylist.algorithm,
    metrics: (snapshot) =>
      snapshot && isArray(snapshot) ? arraylist.metrics(snapshot) : undefined,
    resultText: arraylist.resultText,
    resultCaption: () => "операция выполнена Java-движком",
    idleCaption: "начните с add или сценария",
    Commands: ArrayCommandPanel,
    Diagram: ({ snapshot, step }) =>
      isArray(snapshot) ? <ArrayDiagram state={snapshot} step={step} /> : null,
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
) {
  const state = Object.values(collectionViews)
    .map((view) => ({ view, metrics: view.metrics(snapshot) }))
    .find(({ metrics }) => metrics !== undefined);
  if (!state || !state.metrics) throw new Error("Неизвестный тип снимка");

  let result = "Готов к работе";
  let resultCaption = state.view.idleCaption;
  if (trace) {
    const view = Object.entries(collectionViews).find(
      ([id]) => id === trace.collection,
    )?.[1];
    if (!view) throw new Error("Неизвестная коллекция trace");
    result = view.resultText(trace);
    resultCaption = view.resultCaption(trace);
  }
  return { metrics: state.metrics, result, resultCaption };
}
