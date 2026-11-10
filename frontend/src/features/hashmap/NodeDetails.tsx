import { objectId, resolveSelection, type NodeSelection } from "./identity";
import { isArray, type CollectionSnapshot } from "../../api/types";
import { X } from "lucide-react";
import type { MapNode } from "../../api/types";
import { keyLabel, valueLabel } from "./presentation";

export function NodeDetails({
  node,
  onClose,
}: {
  node: MapNode;
  onClose: () => void;
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
              {v === null
                ? "null"
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : String(v)}
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
) {
  const node =
    snapshot && !isArray(snapshot) ? resolveSelection(snapshot, id) : undefined;
  return node
    ? {
        title: `NODE #${node.id}`,
        content: <NodeDetails node={node} onClose={close} />,
      }
    : undefined;
}
