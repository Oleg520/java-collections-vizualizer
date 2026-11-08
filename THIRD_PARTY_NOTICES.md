# OpenJDK provenance

`core/src/main/java/dev/collectionsviz/core/InstrumentedHashMap.java` contains
adapted portions of OpenJDK 21 `java.util.HashMap`, copyright Oracle and/or its
affiliates and the contributors identified in its preserved source header.

- Repository: https://github.com/openjdk/jdk21u
- Source: `src/java.base/share/classes/java/util/HashMap.java`
- File revision: `3f3a1f534b7f2f5be6d7ded9d9832fa9394e763c`
- Retrieved: 2026-11-06
- SHA-256 of the unmodified upstream file:
  `71c8d82247c2736e9fbe3769f366e9bd250bc73ecf390749998e830201aaabf2`
- License: GNU General Public License, version 2, with the Classpath exception
  where designated by the upstream source header. See [LICENSE](LICENSE),
  [additional license information](licenses/OPENJDK_ADDITIONAL_LICENSE_INFO),
  and [assembly exception](licenses/OPENJDK_ASSEMBLY_EXCEPTION).

Adaptations: changed package and class name; retained the put/get/remove,
resize, treeification, tree split, tree search, insertion/deletion balancing
algorithms; omitted serialization, iterators, views, cloning, other Map methods,
and LinkedHashMap hooks. TreeNode directly extends Node. Added semantic event
calls, immutable snapshot observation, stable node identifiers, and exposure of
resize's temporary local nodes for visualization. Collection values are never
read from private JVM objects through reflection.

The application's original source is distributed under GPL-2.0; the OpenJDK
portions retain their original notices and Classpath exception. Dependency
licenses remain with their respective projects; exact dependencies are recorded
in Maven POM files and `frontend/package-lock.json`.

## ArrayList and growth sizing

`core/src/main/java/dev/collectionsviz/core/ArrayListEngine.java` adapts the
constructor markers, grow, add, indexed insertion/removal, get/set, clear,
indexOf, ensureCapacity and trimToSize algorithms from OpenJDK 21 ArrayList.
The upstream Oracle copyright and GPL-2.0 with Classpath exception header is
preserved. This subset omits iterators, views, modCount/fail-fast behavior,
serialization, cloning, and methods outside the documented command set.
It adds input/resource validation, occurrence IDs, immutable snapshots,
semantic events, and teaching scenarios. No private JDK state is reflected.

- Tag: `jdk-21.0.5+11` in https://github.com/openjdk/jdk21u
- Retrieved: 2026-11-08
- Source: `src/java.base/share/classes/java/util/ArrayList.java`
- SHA-256: `c7db659273f9130e08b0d4508c34ff655e157b9ed48cdc7f5f5a2146ebb1c137`
- Sizing reference: `src/java.base/share/classes/jdk/internal/util/ArraysSupport.java`
- SHA-256: `e9981bbb7caaa1c4d15fb3be016c115d6b48a8456573e7bdd2ca3d8b7dbb9520`

Within the 256-slot teaching limit, sizing follows newLength's ordinary branch.
Requests above that limit are rejected before allocation; hugeLength/OOM paths
are intentionally outside the supported demonstration. Growth policy is an
OpenJDK implementation detail, not an ArrayList public API guarantee.
