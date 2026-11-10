package dev.collectionsviz.core.collections.hashmap;

import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.protocol.Scenario;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.Result;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.protocol.command.KeyType;
import dev.collectionsviz.core.engine.CollectionEngine;
import dev.collectionsviz.core.collections.hashmap.InstrumentedHashMap.Node;

import java.util.*;

/** Not thread safe: a session serializes access. Only immutable records leave this boundary. */
public final class HashMapEngine implements CollectionEngine<HashMapSnapshot> {
    public static final int MAX_ENTRIES = 128;
    private final int initialCapacity;
    private final Map<String,Integer> collisionHashes = new HashMap<>();
    private InstrumentedHashMap<Object,String> map;
    private long nextId = 1, nextObjectId = 1;
    private List<Step<HashMapSnapshot>> recording;
    private Operation current;

    public HashMapEngine() { this(0); }
    public HashMapEngine(int initialCapacity) {
        if (initialCapacity != 0 && initialCapacity != 16 && initialCapacity != 32 && initialCapacity != 64)
            throw new IllegalArgumentException("Начальная ёмкость: 16, 32 или 64 (0 — стандартный конструктор)");
        this.initialCapacity = initialCapacity;
        fresh(initialCapacity);
    }
    private void fresh(int capacity) {
        map = new InstrumentedHashMap<>(capacity, () -> nextId++, () -> nextObjectId++, this::record);
        collisionHashes.clear();
    }
    private void record(String event, String message, Map<String,Object> details) {
        if (recording != null) recording.add(new Step<>(recording.size(), current, event,
            stage(event), message, details, snapshot(event.equals("OPERATION_COMPLETED") ? "COMMITTED" : "WORKING")));
    }
    private static String stage(String event) {
        if (event.contains("SPLIT") || event.startsWith("RESIZE") || event.equals("TABLE_EXPANDED")) return "resize";
        if (event.contains("TREE") || event.equals("TREEIFY_DEFERRED")) return "tree";
        if (event.equals("HASH_CALCULATED")) return "hash";
        if (event.equals("BUCKET_SELECTED")) return "index";
        if (event.contains("COMPARED") || event.contains("COLLISION")) return "search";
        if (event.startsWith("NODE") || event.startsWith("VALUE") || event.startsWith("SIZE")) return "mutation";
        return "operation";
    }
    private Object key(KeySpec spec) {
        if (spec == null || spec.type() == null) throw new IllegalArgumentException("Укажите тип ключа");
        if (spec.type() == KeyType.NULL) {
            if (spec.value() != null || spec.hashCodeOverride() != null) throw new IllegalArgumentException("NULL-ключ не имеет value/hashCode");
            return null;
        }
        if (spec.value() == null || spec.value().length() > 64) throw new IllegalArgumentException("Ключ должен содержать до 64 символов");
        if (spec.type() != KeyType.COLLISION && spec.hashCodeOverride() != null) throw new IllegalArgumentException("hashCode задаётся только для учебного ключа");
        return switch (spec.type()) {
            case STRING -> spec.value();
            case INTEGER -> {
                try { yield Integer.valueOf(spec.value()); }
                catch (NumberFormatException e) { throw new IllegalArgumentException("Integer: целое число от −2147483648 до 2147483647"); }
            }
            case COLLISION -> {
                if (spec.value().isBlank() || spec.hashCodeOverride() == null) throw new IllegalArgumentException("Учебному ключу нужны ID и hashCode");
                Integer previous = collisionHashes.get(spec.value());
                if (previous != null && !previous.equals(spec.hashCodeOverride())) throw new IllegalArgumentException("hashCode этого ID уже закреплён: " + previous + ". Выполните reset для смены.");
                if (previous == null && collisionHashes.size() >= 512) throw new IllegalArgumentException("Лимит 512 учебных ID; выполните reset");
                yield new TeachingKey(spec.value(), spec.hashCodeOverride());
            }
            default -> throw new IllegalArgumentException("Неизвестный ключ");
        };
    }
    @Override public Trace<HashMapSnapshot> execute(Operation operation) {
        return execute(operation, initialCapacity);
    }
    private Trace<HashMapSnapshot> execute(Operation operation, int resetCapacity) {
        if (operation == null || operation.type() == null || !Set.of(OperationType.PUT, OperationType.GET, OperationType.REMOVE, OperationType.CLEAR, OperationType.RESET).contains(operation.type()))
            throw new IllegalArgumentException("Допустимые операции: PUT, GET, REMOVE, CLEAR, RESET");
        if (operation.index() != null || operation.element() != null || operation.minCapacity() != null) throw new IllegalArgumentException("HashMap не принимает поля ArrayList");
        if (operation.value() != null && operation.value().length() > 128) throw new IllegalArgumentException("Значение: до 128 символов");
        Object key = switch(operation.type()) {
            case PUT, GET, REMOVE -> key(operation.key());
            default -> null;
        };
        // Validate bounds before mutation, without adding a second search to the trace.
        Node<Object,String> existing = null;
        if (operation.type() == OperationType.PUT) {
            existing = map.getNode(key);
            if (existing == null && map.size >= MAX_ENTRIES) throw new IllegalArgumentException("Учебный лимит: 128 элементов");
        }
        if (key instanceof TeachingKey k) collisionHashes.putIfAbsent(k.id(), k.hashCode());
        var before = snapshot();
        current = operation;
        recording = new ArrayList<>();
        try {
            map.emit("OPERATION_STARTED", "Начало " + operation.type());
            int hash = InstrumentedHashMap.hash(key);
            if (operation.type() == OperationType.PUT || operation.type() == OperationType.GET || operation.type() == OperationType.REMOVE)
                map.emit("HASH_CALCULATED", key == null ? "null-ключ: hash = 0" : "hash = h ^ (h >>> 16)",
                    "rawHashCode", Objects.hashCode(key), "spreadHash", hash,
                    "formula", key == null ? "null → 0" : Objects.hashCode(key) + " ^ (" + Objects.hashCode(key) + " >>> 16) = " + hash);
            Result result;
            switch (operation.type()) {
                case PUT -> {
                    String old = map.putVal(hash, key, operation.value(), false, true);
                    result = new Result(existing != null, old, operation.value());
                }
                case GET -> {
                    map.select(hash);
                    var node = map.getNode(key);
                    result = new Result(node != null, null, node == null ? null : node.value);
                    map.emit("LOOKUP_RESULT", node == null ? "Ключ не найден" : "Ключ найден; возвращаем значение", "found", node != null, "value", result.value());
                }
                case REMOVE -> {
                    map.select(hash);
                    var node = map.removeNode(hash, key, null, false, true);
                    result = new Result(node != null, node == null ? null : node.value, null);
                    map.emit("REMOVE_RESULT", node == null ? "Ключ не найден; изменений нет" : "Запись удалена", "found", node != null, "previousValue", result.previousValue());
                }
                case CLEAR -> {
                    map.clear();
                    map.emit("MAP_CLEARED", "clear удаляет записи, сохраняя выделенную таблицу");
                    result = new Result(false, null, null);
                }
                case RESET -> {
                    fresh(resetCapacity);
                    map.emit("MAP_RESET", "Новая коллекция: таблица снова выделяется лениво");
                    map.emit("CONFIGURED", resetCapacity == 0
                        ? "Используется new HashMap(); первая таблица будет на 16 бакетов"
                        : "Используется new HashMap(" + resetCapacity + "); массив пока не выделен",
                        "initialCapacity", resetCapacity, "sessionInitialCapacity", initialCapacity);
                    result = new Result(false, null, null);
                }
                default -> throw new IllegalArgumentException("Неизвестная операция");
            }
            map.emit("OPERATION_COMPLETED", "Операция завершена; состояние зафиксировано", "size", map.size);
            return new Trace<>(2, "HASH_MAP", operation, result, before, List.copyOf(recording), snapshot());
        } finally { recording = null; current = null; }
    }
    @Override public HashMapSnapshot snapshot() { return snapshot("COMMITTED"); }
    private HashMapSnapshot snapshot(String phase) {
        return HashMapSnapshotAssembler.capture(map, phase);
    }
    static KeySpec keySpec(Object key) {
        if (key == null) return new KeySpec(KeyType.NULL, null, null);
        if (key instanceof TeachingKey k) return KeySpec.collision(k.id(), k.hashCode());
        return new KeySpec(key instanceof Integer ? KeyType.INTEGER : KeyType.STRING, key.toString(), null);
    }

    public static final List<Scenario> SCENARIOS = List.of(
        new Scenario("insert", "Обычная вставка", "hashCode → spread → индекс → новый узел"),
        new Scenario("collision", "Коллизия", "Три разных ID, один hashCode, одна цепочка"),
        new Scenario("update", "Обновление ключа", "equals находит ключ; меняется value, но не size"),
        new Scenario("resize", "Resize и split", "13-я запись: 16 → 32. Бакет 1 делится на 1 и 17"),
        new Scenario("treeify", "Красно-чёрное дерево", "9 коллизий при capacity = 64; вращения и цвета"),
        new Scenario("why-no-tree", "Почему нет дерева?", "9-я коллизия при capacity = 16 вызывает resize"),
        new Scenario("tree-search", "Поиск в дереве", "Поиск по hash, equals и Comparable"),
        new Scenario("tree-remove", "Удаление из дерева", "Балансировка и tree → list по форме дерева")
    );
    public Trace<HashMapSnapshot> scenario(String name) {
        if (SCENARIOS.stream().noneMatch(s -> s.id().equals(name))) throw new IllegalArgumentException("Неизвестный сценарий");
        var before = snapshot();
        var steps = new ArrayList<Step<HashMapSnapshot>>();
        // Demonstrations own their constructor choice. The session's reset setting stays intact.
        int scenarioCapacity = name.startsWith("tree") ? 64 : 0;
        append(steps, execute(new Operation(OperationType.RESET, null, null), scenarioCapacity));
        Trace<HashMapSnapshot> last;
        switch (name) {
            case "insert" -> last = append(steps, put(KeySpec.string("Java"), "Hello"));
            case "collision" -> {
                append(steps, put(KeySpec.collision("A",42), "Alpha"));
                append(steps, put(KeySpec.collision("B",42), "Beta"));
                last = append(steps, put(KeySpec.collision("C",42), "Gamma"));
            }
            case "update" -> {
                append(steps, put(KeySpec.string("language"), "Java 17"));
                last = append(steps, put(KeySpec.string("language"), "Java 21"));
            }
            case "resize" -> {
                append(steps, put(KeySpec.collision("stay",1), "low"));
                append(steps, put(KeySpec.collision("move",17), "high"));
                for(int i=2;i<=11;i++) append(steps, put(KeySpec.collision("K"+i,i), "v"+i));
                last = append(steps, put(KeySpec.collision("trigger",12), "resize"));
            }
            default -> {
                last = null;
                for (int i=1;i<=9;i++) last = append(steps, put(KeySpec.collision("K"+i,42), "v"+i));
                if (name.equals("tree-search")) last=append(steps, execute(new Operation(OperationType.GET,KeySpec.collision("K7",42),null)));
                if (name.equals("tree-remove")) for (int i=1;i<=8;i++) last=append(steps, execute(new Operation(OperationType.REMOVE,KeySpec.collision("K"+i,42),null)));
            }
        }
        var indexed = new ArrayList<Step<HashMapSnapshot>>();
        for (var s:steps) indexed.add(new Step<>(indexed.size(),s.operation(),s.event(),s.stage(),s.message(),s.details(),s.snapshot()));
        return new Trace<>(2,"HASH_MAP",new Operation(OperationType.SCENARIO,null,name),last.result(),before,List.copyOf(indexed),snapshot());
    }
    private Trace<HashMapSnapshot> put(KeySpec key, String value) { return execute(new Operation(OperationType.PUT,key,value)); }
    private static Trace<HashMapSnapshot> append(List<Step<HashMapSnapshot>> steps, Trace<HashMapSnapshot> trace) {
        steps.addAll(trace.steps()); return trace;
    }
}
