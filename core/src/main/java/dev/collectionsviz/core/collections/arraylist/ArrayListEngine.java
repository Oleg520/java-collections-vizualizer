/*
 * Copyright (c) 1997, 2023, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */

package dev.collectionsviz.core.collections.arraylist;

import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.protocol.Scenario;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.Result;
import dev.collectionsviz.core.protocol.command.Element;
import dev.collectionsviz.core.protocol.command.ElementType;
import dev.collectionsviz.core.engine.CollectionEngine;

import java.util.*;

/**
 * Instrumented subset adapted from OpenJDK jdk-21.0.5+11 ArrayList.
 * Occurrence IDs are a parallel teaching overlay; elementData holds actual Java values.
 * Session locking serializes access. Validation precedes all mutation and ID allocation.
 */
public final class ArrayListEngine implements CollectionEngine<ArrayListSnapshot> {
    public static final int MAX_SIZE = 128, MAX_CAPACITY = 256;
    private final Integer initialCapacity;
    private Object[] elementData;
    private long[] ids;
    private int size;
    private boolean defaultEmpty;
    private long nextId = 1, nextBufferId = 1, bufferId;
    private Object[] pending;
    private long[] pendingIds;
    private long pendingId;
    private Operation current;
    private List<Step<ArrayListSnapshot>> recording;

    public ArrayListEngine() {
        this(null);
    }

    public ArrayListEngine(Integer capacity) {
        if (capacity != null && (capacity < 0 || capacity > MAX_CAPACITY))
            throw new IllegalArgumentException("Начальная ёмкость: 0..256; отсутствие — default constructor");
        initialCapacity = capacity;
        fresh(capacity);
    }

    private void fresh(Integer capacity) {
        defaultEmpty = capacity == null;
        elementData = new Object[capacity == null ? 0 : capacity];
        ids = new long[elementData.length];
        bufferId = elementData.length == 0 ? 0 : nextBufferId++;
        size = 0;
    }

    private static Object value(Element element) {
        if (element == null || element.type() == null)
            throw new IllegalArgumentException("Укажите element с типом STRING, INTEGER или NULL");
        if (element.type() == ElementType.NULL) {
            if (element.value() != null) throw new IllegalArgumentException("NULL не имеет значения");
            return null;
        }
        if (element.value() == null || element.value().length() > 128)
            throw new IllegalArgumentException("Значение: до 128 символов");
        if (element.type() == ElementType.STRING) return element.value();
        try {
            return Integer.valueOf(element.value());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Integer: целое число от −2147483648 до 2147483647");
        }
    }

    private int grownCapacity(int minimum) {
        // Within the demo bounds this is ArraysSupport.newLength's non-overflow branch.
        long length = defaultEmpty ? Math.max(10, minimum)
                : (long) elementData.length + Math.max(minimum - elementData.length, elementData.length >> 1);
        if (length > MAX_CAPACITY)
            throw new IllegalArgumentException("Учебный лимит capacity: 256; вычисленный рост: " + length);
        return (int) length;
    }

    @Override
    public Trace<ArrayListSnapshot> execute(Operation op) {
        return execute(op, initialCapacity);
    }

    private Trace<ArrayListSnapshot> execute(Operation op, Integer resetCapacity) {
        if (op == null || op.type() == null) throw new IllegalArgumentException("Укажите операцию ArrayList");
        if (op.key() != null || op.value() != null)
            throw new IllegalArgumentException("ArrayList использует index и element, а не key/value");
        Object input = null;
        switch (op.type()) {
            case ADD, ADD_AT, SET_AT, INDEX_OF -> input = value(op.element());
            case GET_AT, REMOVE_AT, CLEAR, RESET, ENSURE_CAPACITY, TRIM_TO_SIZE -> {
                if (op.element() != null) throw new IllegalArgumentException("Эта операция не принимает element");
            }
            default -> throw new IllegalArgumentException("Операция недоступна для ArrayList");
        }
        boolean indexed = Set.of(OperationType.ADD_AT, OperationType.GET_AT, OperationType.SET_AT,
                OperationType.REMOVE_AT).contains(op.type());
        if (!indexed && op.index() != null) throw new IllegalArgumentException("Эта операция не принимает index");
        if (indexed && (op.index() == null || op.index() < 0 ||
                op.index() > (op.type() == OperationType.ADD_AT ? size : size - 1)))
            throw new IllegalArgumentException("Индекс вне диапазона: " + op.index() + "; size = " + size);
        if (op.type() == OperationType.ADD || op.type() == OperationType.ADD_AT) {
            if (size == MAX_SIZE) throw new IllegalArgumentException("Учебный лимит: 128 элементов");
            if (size == elementData.length) grownCapacity(size + 1);
        }
        if (op.type() == OperationType.ENSURE_CAPACITY) {
            if (op.minCapacity() == null) throw new IllegalArgumentException("Укажите minCapacity (Java int)");
            if (op.minCapacity() > elementData.length && !(defaultEmpty && op.minCapacity() <= 10))
                grownCapacity(op.minCapacity());
        }
        var before = snapshot();
        current = op;
        recording = new ArrayList<>();
        Result result = Result.array("VOID", null, null, null);
        try {
            emit("OPERATION_STARTED", "operation", "Начало " + op.type());
            if (indexed) emit("INDEX_CHECKED", "index", "Индекс допустим", "index", op.index(), "size", size);
            int index = op.index() == null ? size : op.index();
            switch (op.type()) {
                case ADD, ADD_AT -> {
                    emit("CAPACITY_CHECKED", "capacity", "Проверка места для новой ссылки", "minimumCapacity", size + 1,
                            "capacity", elementData.length);
                    if (size == elementData.length) reallocate(grownCapacity(size + 1), "CAPACITY_GROWN", size + 1);
                    if (op.type() == OperationType.ADD_AT && index < size) {
                        System.arraycopy(elementData, index, elementData, index + 1, size - index);
                        System.arraycopy(ids, index, ids, index + 1, size - index);
                        emit("ELEMENTS_SHIFTED_RIGHT", "shift",
                                "Эффект одного System.arraycopy: диапазон сдвинут вправо", "fromIndex", index,
                                "toIndex", index + 1, "length", size - index, "primitive", "System.arraycopy");
                    }
                    elementData[index] = input;
                    ids[index] = nextId++;
                    emit("ELEMENT_WRITTEN", "mutation", "Новая ссылка записана", "index", index);
                    size++;
                    if (op.type() == OperationType.ADD) result = Result.array("BOOLEAN", null, true, null);
                }
                case GET_AT, SET_AT, REMOVE_AT -> {
                    var old = Element.of(elementData[index]);
                    emit("ELEMENT_READ", "index", "Прямой доступ по индексу", "index", index, "element", old);
                    result = Result.array("ELEMENT", old, null, null);
                    if (op.type() == OperationType.SET_AT) {
                        elementData[index] = input;
                        ids[index] = nextId++;
                        emit("ELEMENT_REPLACED", "mutation", "Заменена ссылка; size и capacity прежние", "index",
                                index);
                    } else if (op.type() == OperationType.REMOVE_AT) {
                        if (index < size - 1) {
                            System.arraycopy(elementData, index + 1, elementData, index, size - index - 1);
                            System.arraycopy(ids, index + 1, ids, index, size - index - 1);
                            emit("ELEMENTS_SHIFTED_LEFT", "shift",
                                    "Эффект одного System.arraycopy: хвост сдвинут влево", "fromIndex", index + 1,
                                    "toIndex", index, "length", size - index - 1, "primitive", "System.arraycopy");
                        }
                        elementData[--size] = null;
                        ids[size] = 0;
                        emit("TAIL_CLEARED", "mutation", "Последняя ссылка очищена, size уменьшен", "index", size);
                    }
                }
                case INDEX_OF -> {
                    int found = -1;
                    for (int i = 0; i < size; i++) {
                        boolean equal = Objects.equals(input, elementData[i]);
                        emit("ELEMENT_COMPARED", "search", "Сравнение слева направо: null или equals", "index", i,
                                "equal", equal);
                        if (equal) {
                            found = i;
                            break;
                        }
                    }
                    emit(found < 0 ? "ELEMENT_NOT_FOUND" : "ELEMENT_FOUND", "search",
                            found < 0 ? "Значение не найдено: −1" : "Найдено первое вхождение", "index", found);
                    result = Result.array("INT", null, null, found);
                }
                case CLEAR -> {
                    Arrays.fill(elementData, 0, size, null);
                    Arrays.fill(ids, 0, size, 0);
                    size = 0;
                    emit("LIST_CLEARED", "mutation", "Все ссылки очищены; capacity сохранена");
                }
                case RESET -> {
                    fresh(resetCapacity);
                    emit("LIST_RESET", "operation", "Учебный reset: новая структура с выбранным конструктором",
                            "constructor", resetCapacity == null ? "default" : resetCapacity);
                    result = Result.array("RESET", null, null, null);
                }
                case ENSURE_CAPACITY -> {
                    int minimum = op.minCapacity();
                    emit("CAPACITY_CHECKED", "capacity",
                            "Default-empty и minCapacity ≤ 10: выделение не требуется; отрицательный minCapacity — no-op",
                            "minimumCapacity", minimum);
                    if (minimum > elementData.length && !(defaultEmpty && minimum <= 10))
                        reallocate(grownCapacity(minimum), "CAPACITY_RESERVED", minimum);
                }
                case TRIM_TO_SIZE -> {
                    if (size < elementData.length) reallocate(size, "CAPACITY_TRIMMED", size);
                    else
                        emit("CAPACITY_CHECKED", "capacity", "Ёмкость уже равна size; буфер и пустой маркер сохранены");
                }
                default -> throw new AssertionError(op.type());
            }
            emit("OPERATION_COMPLETED", "operation", "Операция завершена; состояние зафиксировано", "result", result);
            return new Trace<>(1, "ARRAY_LIST", op, result, before, List.copyOf(recording), snapshot());
        } finally {
            recording = null;
            current = null;
        }
    }

    private void reallocate(int capacity, String event, int minimum) {
        int old = elementData.length;
        pending = new Object[capacity];
        pendingIds = new long[capacity];
        pendingId = capacity == 0 ? 0 : nextBufferId++;
        emit("ARRAY_ALLOCATED", "capacity", "Подготовлен другой буфер elementData", "oldCapacity", old, "newCapacity",
                capacity, "minimumCapacity", minimum, "minGrowth", minimum - old, "preferredGrowth", old >> 1);
        emit("ARRAY_COPY_STARTED", "capacity", "Копируются ссылки, объекты не клонируются", "length",
                Math.min(old, capacity), "primitive", "Arrays.copyOf / System.arraycopy");
        System.arraycopy(elementData, 0, pending, 0, Math.min(old, capacity));
        System.arraycopy(ids, 0, pendingIds, 0, Math.min(old, capacity));
        emit("ARRAY_COPY_COMPLETED", "capacity", "Ссылки перенесены в новый буфер", "length", Math.min(old, capacity));
        elementData = pending;
        ids = pendingIds;
        bufferId = pendingId;
        defaultEmpty = false;
        pending = null;
        pendingIds = null;
        emit(event, "capacity", "elementData переключён на новый буфер", "oldCapacity", old, "newCapacity", capacity,
                "minimumCapacity", minimum, "minGrowth", minimum - old, "preferredGrowth", old >> 1);
    }

    private void emit(String event, String stage, String message, Object... pairs) {
        var details = new LinkedHashMap<String, Object>();
        for (int i = 0; i < pairs.length; i += 2) details.put((String) pairs[i], pairs[i + 1]);
        recording.add(new Step<>(recording.size(), current, event, stage, message, Collections.unmodifiableMap(details),
                snapshot(event.equals("OPERATION_COMPLETED") ? "COMMITTED" : "WORKING")));
    }

    @Override
    public ArrayListSnapshot snapshot() {
        return snapshot("COMMITTED");
    }

    private ArrayListSnapshot snapshot(String phase) {
        return new ArrayListSnapshot("ARRAY_LIST", phase, size, elementData.length,
                defaultEmpty ? "DEFAULT_EMPTY" : elementData.length == 0 ? "EXPLICIT_EMPTY" : "ALLOCATED",
                initialCapacity,
                buffer(bufferId, elementData, ids), pending == null ? null : buffer(pendingId, pending, pendingIds));
    }

    private static Buffer buffer(long id, Object[] values, long[] ids) {
        var cells = new ArrayList<Cell>(values.length);
        for (int i = 0; i < values.length; i++) cells.add(ids[i] == 0 ? null : new Cell(ids[i], Element.of(values[i])));
        return new Buffer(id, values.length, Collections.unmodifiableList(cells));
    }

    public static final List<Scenario> SCENARIOS = List.of(
            new Scenario("first-add", "Первое добавление", "Default constructor: 0 → 10"),
            new Scenario("explicit-zero", "Конструктор с нулём", "new ArrayList<>(0): 0 → 1"),
            new Scenario("growth", "Автоматическое расширение", "11-й элемент: 10 → 15; копирование ссылок"),
            new Scenario("insert-middle", "Вставка в середину", "add(1, X): сдвиг вправо"),
            new Scenario("remove-middle", "Удаление из середины", "remove(1): сдвиг влево и очистка хвоста"),
            new Scenario("read-replace", "Чтение и замена", "get / set: size и capacity прежние"),
            new Scenario("nulls", "Настоящий null", "Занятые null, строка null и свободные ячейки"),
            new Scenario("capacity", "Управление ёмкостью", "ensureCapacity / trimToSize / clear"),
            new Scenario("linear-search", "Линейный поиск", "Первое совпадение, дубликаты и −1")
    );

    @Override
    public Trace<ArrayListSnapshot> scenario(String name) {
        if (SCENARIOS.stream().noneMatch(s -> s.id().equals(name)))
            throw new IllegalArgumentException("Неизвестный сценарий ArrayList");
        var before = snapshot();
        var steps = new ArrayList<Step<ArrayListSnapshot>>();
        append(steps, execute(Operation.array(OperationType.RESET, null, null, null),
                name.equals("explicit-zero") ? 0 : null));
        switch (name) {
            case "first-add", "explicit-zero" -> add(steps, "A");
            case "growth" -> {
                for (int i = 0; i < 11; i++) add(steps, i);
            }
            case "insert-middle", "remove-middle", "read-replace" -> {
                add(steps, "A");
                add(steps, "B");
                add(steps, "C");
                if (name.equals("insert-middle")) run(steps, OperationType.ADD_AT, 1, "X", null);
                else if (name.equals("remove-middle")) run(steps, OperationType.REMOVE_AT, 1, null, null);
                else {
                    run(steps, OperationType.GET_AT, 1, null, null);
                    run(steps, OperationType.SET_AT, 1, 42, null);
                }
            }
            case "nulls" -> {
                add(steps, null);
                add(steps, "null");
                add(steps, null);
                run(steps, OperationType.GET_AT, 0, null, null);
                run(steps, OperationType.SET_AT, 2, null, null);
                run(steps, OperationType.REMOVE_AT, 2, null, null);
            }
            case "capacity" -> {
                run(steps, OperationType.ENSURE_CAPACITY, null, null, 10);
                add(steps, "A");
                run(steps, OperationType.ENSURE_CAPACITY, null, null, 24);
                run(steps, OperationType.TRIM_TO_SIZE, null, null, null);
                run(steps, OperationType.CLEAR, null, null, null);
                run(steps, OperationType.TRIM_TO_SIZE, null, null, null);
                add(steps, "B");
            }
            case "linear-search" -> {
                add(steps, "A");
                add(steps, 42);
                add(steps, "A");
                add(steps, null);
                run(steps, OperationType.INDEX_OF, null, "A", null);
                run(steps, OperationType.INDEX_OF, null, null, null);
                run(steps, OperationType.INDEX_OF, null, "missing", null);
            }
        }
        var last = steps.getLast();
        var result = (Result) last.details().get("result");
        return new Trace<>(1, "ARRAY_LIST", new Operation(OperationType.SCENARIO, null, name), result, before,
                List.copyOf(steps), snapshot());
    }

    private void add(List<Step<ArrayListSnapshot>> steps, Object value) {
        run(steps, OperationType.ADD, null, value, null);
    }

    private void run(List<Step<ArrayListSnapshot>> steps, OperationType type, Integer index, Object value,
                     Integer capacity) {
        Element element = switch (type) {
            case ADD, ADD_AT, SET_AT, INDEX_OF -> Element.of(value);
            default -> null;
        };
        append(steps, execute(Operation.array(type, index, element, capacity)));
    }

    private static void append(List<Step<ArrayListSnapshot>> steps, Trace<ArrayListSnapshot> trace) {
        for (var s : trace.steps())
            steps.add(new Step<>(steps.size(), s.operation(), s.event(), s.stage(), s.message(), s.details(),
                    s.snapshot()));
    }
}
