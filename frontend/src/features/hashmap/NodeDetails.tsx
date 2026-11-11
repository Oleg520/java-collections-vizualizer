import { objectId, resolveSelection, type NodeSelection } from "./identity";
import { isArray, type CollectionSnapshot } from "../../api/types";
import { X } from "lucide-react";
import type { MapNode } from "../../api/types";
import { keyLabel, valueLabel } from "./presentation";

export function NodeDetails({
  node,
  onClose,
  representations = [],
  onSelect,
  references,
}: {
  node: MapNode;
  onClose: () => void;
  representations?: MapNode[];
  references?: Map<number, MapNode>;
  onSelect?: (selection: NodeSelection) => void;
}) {
  return (
    <>
      <button
        className="close-node icon-button"
        aria-label="Закрыть сведения об узле"
        onClick={onClose}
      >
        <X size={14} />
      </button>
      <div className="step-op">
        {keyLabel(node.key)} → {valueLabel(node.value)}
      </div>
      {representations.length > 1 && onSelect && (
        <label className="field">
          <span>Физическое представление записи</span>
          <select
            aria-label="Физическое представление записи"
            value={objectId(node)}
            onChange={(e) =>
              onSelect({
                logicalId: node.id,
                preferredObjectId: Number(e.target.value),
              })
            }
          >
            {representations.map((n) => (
              <option key={objectId(n)} value={objectId(n)}>
                obj {objectId(n)} · {n.linked ? "в цепочке" : "вне цепочки"}
              </option>
            ))}
          </select>
        </label>
      )}
      <dl>
        {Object.entries({
          objectId: objectId(node),
          type: node.key.type,
          hashCode: node.rawHashCode,
          hash: node.hash,
          next: node.next,
          prev: node.prev,
          parent: node.parent,
          left: node.left,
          right: node.right,
          color: node.red === null ? "—" : node.red ? "RED" : "BLACK",
          linked: node.linked,
        }).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>
              {onSelect &&
              ["next", "prev", "parent", "left", "right"].includes(k) &&
              typeof v === "number" &&
              references?.has(v) ? (
                <button
                  className="node-reference"
                  aria-label={`${k} → obj ${v}, перейти к записи ${references.get(v)!.id}`}
                  onClick={() => {
                    const target = references.get(v)!;
                    onSelect({
                      logicalId: target.id,
                      preferredObjectId: target.objectId,
                    });
                  }}
                >
                  {v} ↗
                </button>
              ) : v === null ? (
                "null"
              ) : typeof v === "object" ? (
                JSON.stringify(v)
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function selectedDetails(
  snapshot: CollectionSnapshot | undefined,
  id: NodeSelection | undefined,
  close: () => void,
  onSelect?: (selection: NodeSelection) => void,
) {
  const node =
    snapshot && !isArray(snapshot) ? resolveSelection(snapshot, id) : undefined;
  return node
    ? {
        title: `NODE #${node.id}`,
        content: (
          <NodeDetails
            node={node}
            references={
              snapshot && !isArray(snapshot)
                ? new Map(
                    [...snapshot.buckets, ...snapshot.pendingBuckets]
                      .flatMap((b) => b.nodes)
                      .map((n) => [n.objectId, n]),
                  )
                : undefined
            }
            onClose={close}
            onSelect={onSelect}
            representations={
              snapshot && !isArray(snapshot)
                ? [...snapshot.buckets, ...snapshot.pendingBuckets]
                    .flatMap((b) => b.nodes)
                    .filter((n) => n.id === node.id)
                : []
            }
          />
        ),
      }
    : undefined;
}
