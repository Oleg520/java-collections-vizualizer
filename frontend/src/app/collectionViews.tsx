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
  const array = snapshot && isArray(snapshot);
  return {
    metrics: array ? arraylist.metrics(snapshot) : hashmap.metrics(snapshot),
    result: trace
      ? trace.collection === "ARRAY_LIST"
        ? arraylist.resultText(trace)
        : hashmap.resultText(trace)
      : "Готов к работе",
    resultCaption: trace
      ? trace.collection === "HASH_MAP" && trace.result.found
        ? "ключ найден в коллекции"
        : "операция выполнена Java-движком"
      : array
        ? "начните с add или сценария"
        : "начните с put или сценария",
  };
}
