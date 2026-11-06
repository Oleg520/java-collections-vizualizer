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
