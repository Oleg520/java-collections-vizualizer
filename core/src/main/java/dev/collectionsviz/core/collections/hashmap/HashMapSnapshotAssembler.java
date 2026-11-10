package dev.collectionsviz.core.collections.hashmap;

import java.util.*;

import dev.collectionsviz.core.collections.hashmap.InstrumentedHashMap.Node;
import dev.collectionsviz.core.collections.hashmap.InstrumentedHashMap.TreeNode;

/**
 * Captures physical objects without changing the algorithm. Placement is not Java ownership.
 */
final class HashMapSnapshotAssembler {
    private static final class Area {
        final int index;
        final String kind;
        final Node<Object, String> head;
        final List<Node<Object, String>> nodes = new ArrayList<>();

        Area(int index, String kind, Node<Object, String> head) {
            this.index = index;
            this.kind = kind;
            this.head = head;
        }

        Bucket freeze(Set<Node<Object, String>> linked) {
            Long root = head instanceof TreeNode<Object, String> t ? t.root().objectId : null;
            return new Bucket(index, kind, head.objectId, root,
                    nodes.stream().map(n -> view(n, linked.contains(n))).toList());
        }
    }

    static HashMapSnapshot capture(InstrumentedHashMap<Object, String> map, String phase) {
        var owners = new IdentityHashMap<Node<Object, String>, Area>();
        Set<Node<Object, String>> linked = Collections.newSetFromMap(new IdentityHashMap<>());
        var current = seed(map.table, owners, linked);
        var pending = seed(map.pendingTable, owners, linked);
        if (!map.inFlight.isEmpty()) {
            Area transfer = null;
            for (var n : map.inFlight)
                if (!owners.containsKey(n)) {
                    if (transfer == null) {
                        transfer = new Area(map.inFlightIndex, "TRANSFER", n);
                        pending.add(transfer);
                    }
                    owners.put(n, transfer);
                    transfer.nodes.add(n);
                }
        }
        // Seed ALL chains first, so stale pointers cannot steal another area's live objects.
        var areas = new ArrayList<>(current);
        areas.addAll(pending);
        var queue = new ArrayList<Node<Object, String>>();
        areas.forEach(a -> queue.addAll(a.nodes));
        for (int i = 0; i < queue.size(); i++) {
            var n = queue.get(i);
            var area = owners.get(n);
            var refs = new ArrayList<Node<Object, String>>();
            refs.add(n.next);
            if (n instanceof TreeNode<Object, String> t) refs.addAll(Arrays.asList(t.parent, t.left, t.right, t.prev));
            for (var ref : refs)
                if (ref != null && !owners.containsKey(ref)) {
                    owners.put(ref, area);
                    area.nodes.add(ref);
                    queue.add(ref);
                }
        }
        return new HashMapSnapshot(phase, map.size, map.table == null ? 0 : map.table.length, map.threshold,
                map.loadFactor,
                map.pendingTable == null ? 0 : map.pendingTable.length,
                current.stream().map(a -> a.freeze(linked)).toList(),
                pending.stream().map(a -> a.freeze(linked)).toList());
    }

    private static List<Area> seed(Node<Object, String>[] table, IdentityHashMap<Node<Object, String>, Area> owners,
                                   Set<Node<Object, String>> linked) {
        var areas = new ArrayList<Area>();
        if (table != null) for (int i = 0; i < table.length; i++)
            if (table[i] != null) {
                var head = table[i];
                var area = new Area(i, head instanceof TreeNode ? "TREE" : "LIST", head);
                areas.add(area);
                Set<Node<Object, String>> seen = Collections.newSetFromMap(new IdentityHashMap<>());
                for (var n = head; n != null && seen.add(n); n = n.next) {
                    linked.add(n);
                    if (!owners.containsKey(n)) {
                        owners.put(n, area);
                        area.nodes.add(n);
                    }
                }
            }
        return areas;
    }

    private static Long id(Node<?, ?> n) {
        return n == null ? null : n.objectId;
    }

    private static NodeView view(Node<Object, String> n, boolean linked) {
        var t = n instanceof TreeNode<Object, String> tree ? tree : null;
        return new NodeView(n.id, n.objectId, HashMapEngine.keySpec(n.key), n.value, Objects.hashCode(n.key), n.hash,
                id(n.next), t == null ? null : id(t.parent), t == null ? null : id(t.left),
                t == null ? null : id(t.right),
                t == null ? null : id(t.prev), t == null ? null : t.red, linked);
    }
}
