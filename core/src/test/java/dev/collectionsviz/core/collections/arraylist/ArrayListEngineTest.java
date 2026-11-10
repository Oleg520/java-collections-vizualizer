package dev.collectionsviz.core.collections.arraylist;

import dev.collectionsviz.core.protocol.Step;
import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.OperationType;
import dev.collectionsviz.core.protocol.command.KeySpec;
import dev.collectionsviz.core.protocol.command.Element;
import dev.collectionsviz.core.collections.hashmap.HashMapEngine;

import java.util.*;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static dev.collectionsviz.core.protocol.command.OperationType.*;

class ArrayListEngineTest {
    static Trace<ArrayListSnapshot> run(ArrayListEngine e, OperationType type, Integer index, Object value,
                                        Integer cap) {
        Element element = switch (type) {
            case ADD, ADD_AT, SET_AT, INDEX_OF -> Element.of(value);
            default -> null;
        };
        return e.execute(Operation.array(type, index, element, cap));
    }

    static Trace<ArrayListSnapshot> run(ArrayListEngine e, OperationType type) {
        return run(e, type, null, null, null);
    }

    static Trace<ArrayListSnapshot> add(ArrayListEngine e, Object value) {
        return run(e, ADD, null, value, null);
    }

    static List<Object> contents(ArrayListSnapshot s) {
        return s.buffer().cells().subList(0, s.size()).stream().<Object>map(c -> switch (c.element().type()) {
            case NULL -> null;
            case INTEGER -> Integer.valueOf(c.element().value());
            case STRING -> c.element().value();
        }).toList();
    }

    static void invariant(ArrayListSnapshot s) {
        assertEquals("COMMITTED", s.phase());
        assertTrue(s.size() >= 0 && s.size() <= s.capacity());
        assertNull(s.pendingBuffer());
        assertEquals(s.capacity(), s.buffer().cells().size());
        assertTrue(s.buffer().cells().subList(s.size(), s.capacity()).stream().allMatch(Objects::isNull));
        assertEquals(s.size(), s.buffer().cells().subList(0, s.size()).stream().map(Cell::id).distinct().count());
    }

    @Test
    void constructorMarkersGrowthAndTrimFollowPinnedJdk() {
        assertThrows(IllegalArgumentException.class, () -> new ArrayListEngine(-1));
        assertThrows(IllegalArgumentException.class, () -> new ArrayListEngine(257));
        var d = new ArrayListEngine();
        assertEquals("DEFAULT_EMPTY", d.snapshot().emptyMode());
        run(d, ENSURE_CAPACITY, null, null, 10);
        assertEquals(0, d.snapshot().capacity());
        run(d, TRIM_TO_SIZE);
        assertEquals("DEFAULT_EMPTY", d.snapshot().emptyMode());
        add(d, "A");
        assertEquals(10, d.snapshot().capacity());
        for (int i = 1; i < 10; i++) add(d, i);
        var grow = add(d, 10);
        assertEquals(15, d.snapshot().capacity());
        for (int i = 11; i < 16; i++) add(d, i);
        assertEquals(22, d.snapshot().capacity());
        var copied = grow.steps().stream().filter(s -> s.event().equals("ARRAY_COPY_COMPLETED")).findFirst()
                .orElseThrow();
        assertEquals(10, copied.snapshot().buffer().capacity());
        assertEquals(15, copied.snapshot().pendingBuffer().capacity());
        assertEquals(copied.snapshot().buffer().cells(), copied.snapshot().pendingBuffer().cells().subList(0, 10));
        assertEquals(5, grow.steps().stream().filter(s -> s.event().equals("CAPACITY_GROWN")).findFirst().orElseThrow()
                .details().get("preferredGrowth"));
        run(d, CLEAR);
        assertEquals(22, d.snapshot().capacity());
        run(d, TRIM_TO_SIZE);
        assertEquals("EXPLICIT_EMPTY", d.snapshot().emptyMode());
        add(d, null);
        assertEquals(1, d.snapshot().capacity());
        run(d, RESET);
        assertEquals("DEFAULT_EMPTY", d.snapshot().emptyMode());
        var zero = new ArrayListEngine(0);
        add(zero, 0);
        assertEquals(1, zero.snapshot().capacity());
        add(zero, 1);
        assertEquals(2, zero.snapshot().capacity());
        var positive = new ArrayListEngine(5);
        assertEquals(5, positive.snapshot().capacity());
        add(positive, 0);
        assertEquals(5, positive.snapshot().capacity());
        run(positive, ENSURE_CAPACITY, null, null, 9);
        assertEquals(9, positive.snapshot().capacity());
        var before = positive.snapshot();
        run(positive, ENSURE_CAPACITY, null, null, -1);
        assertEquals(before, positive.snapshot());
    }

    @Test
    void shiftingNullIdentityResultsAndImmutableSnapshots() {
        var e = new ArrayListEngine();
        add(e, null);
        add(e, null);
        add(e, "null");
        var before = e.snapshot();
        var inserted = run(e, ADD_AT, 1, 42, null);
        assertEquals("VOID", inserted.result().kind());
        assertEquals(Arrays.asList(null, 42, null, "null"), contents(e.snapshot()));
        assertEquals(before.buffer().cells().get(1).id(), e.snapshot().buffer().cells().get(2).id());
        var shifted = inserted.steps().stream().filter(s -> s.event().equals("ELEMENTS_SHIFTED_RIGHT")).findFirst()
                .orElseThrow().snapshot();
        assertEquals(shifted.buffer().cells().get(1), shifted.buffer().cells().get(2));
        assertEquals("WORKING", shifted.phase());
        assertEquals(Element.of(null), run(e, GET_AT, 0, null, null).result().element());
        assertEquals(Element.of(null), run(e, SET_AT, 0, "", null).result().element());
        assertEquals(Element.of(42), run(e, REMOVE_AT, 1, null, null).result().element());
        assertEquals(Arrays.asList(null, null, "null"), contents(before));
        assertEquals(1, run(e, INDEX_OF, null, null, null).result().intValue());
        assertEquals(-1, run(e, INDEX_OF, null, 42, null).result().intValue());
        assertEquals(inserted.committed(), inserted.steps().getLast().snapshot());
        invariant(e.snapshot());
        run(e, CLEAR);
        invariant(e.snapshot());
    }

    @Test
    void invalidOperationsAndLimitsNeverChangeState() {
        var e = new ArrayListEngine();
        var before = e.snapshot();
        for (var op : List.of(Operation.array(GET_AT, 0, null, null), Operation.array(ADD_AT, 1, Element.of("A"), null),
                Operation.array(REMOVE_AT, -1, null, null), Operation.array(GET_AT, null, null, null),
                Operation.array(ADD, null, null, null), Operation.array(ENSURE_CAPACITY, null, null, Integer.MAX_VALUE),
                new Operation(PUT, KeySpec.string("x"), "x"))) {
            assertThrows(IllegalArgumentException.class, () -> e.execute(op));
            assertEquals(before, e.snapshot());
        }
        for (int i = 0; i < 128; i++) add(e, i);
        before = e.snapshot();
        assertThrows(IllegalArgumentException.class, () -> add(e, 128));
        assertEquals(before, e.snapshot());
        var capped = new ArrayListEngine(200);
        var snapshot = capped.snapshot();
        assertThrows(IllegalArgumentException.class, () -> run(capped, ENSURE_CAPACITY, null, null, 201));
        assertEquals(snapshot, capped.snapshot());
        assertThrows(IllegalArgumentException.class,
                () -> new HashMapEngine().execute(Operation.array(ADD, null, Element.of(1), null)));
    }

    @Test
    void deterministicRandomOperationsMatchRealJavaArrayListWithoutReflection() {
        for (Integer capacity : Arrays.asList(null, 0, 1, 16)) {
            var e = new ArrayListEngine(capacity);
            var oracle = capacity == null ? new ArrayList<Object>() : new ArrayList<Object>(capacity);
            var random = new Random(2105);
            Object[] values = {null, null, "42", 42, "null", "", Integer.MIN_VALUE, Integer.MAX_VALUE, "Привет 🌱"};
            for (int n = 0; n < 2500; n++) {
                Object value = values[random.nextInt(values.length)];
                int index = oracle.isEmpty() ? 0 : random.nextInt(oracle.size());
                switch (random.nextInt(10)) {
                    case 0 -> {
                        assertEquals(oracle.add(value), add(e, value).result().booleanValue());
                    }
                    case 1 -> {
                        int at = random.nextInt(oracle.size() + 1);
                        oracle.add(at, value);
                        run(e, ADD_AT, at, value, null);
                    }
                    case 2 -> {
                        if (!oracle.isEmpty()) assertEquals(Element.of(oracle.get(index)),
                                run(e, GET_AT, index, null, null).result().element());
                    }
                    case 3 -> {
                        if (!oracle.isEmpty()) assertEquals(Element.of(oracle.set(index, value)),
                                run(e, SET_AT, index, value, null).result().element());
                    }
                    case 4 -> {
                        if (!oracle.isEmpty()) assertEquals(Element.of(oracle.remove(index)),
                                run(e, REMOVE_AT, index, null, null).result().element());
                    }
                    case 5 -> assertEquals(oracle.indexOf(value),
                            run(e, INDEX_OF, null, value, null).result().intValue());
                    case 6 -> {
                        oracle.clear();
                        run(e, CLEAR);
                    }
                    case 7 -> {
                        oracle.trimToSize();
                        run(e, TRIM_TO_SIZE);
                    }
                    case 8 -> {
                        int min = random.nextInt(50) - 10;
                        oracle.ensureCapacity(min);
                        run(e, ENSURE_CAPACITY, null, null, min);
                    }
                    case 9 -> {
                        var before = e.snapshot();
                        int bad = oracle.size();
                        assertThrows(IndexOutOfBoundsException.class, () -> oracle.get(bad));
                        assertThrows(IllegalArgumentException.class, () -> run(e, GET_AT, bad, null, null));
                        assertEquals(before, e.snapshot());
                    }
                }
                assertEquals(oracle, contents(e.snapshot()), "iteration " + n);
                invariant(e.snapshot());
            }
        }
    }

    @Test
    void allScenariosAreIndependentAndResetKeepsSessionConstructor() {
        for (var scenario : ArrayListEngine.SCENARIOS) {
            var e = new ArrayListEngine(5);
            add(e, "unrelated");
            var trace = e.scenario(scenario.id());
            invariant(trace.committed());
            var fresh = new ArrayListEngine(5).scenario(scenario.id());
            assertEquals(contents(fresh.committed()), contents(trace.committed()));
            assertEquals(fresh.committed().capacity(), trace.committed().capacity());
            for (int i = 0; i < trace.steps().size(); i++) assertEquals(i, trace.steps().get(i).index());
            run(e, RESET);
            assertEquals(5, e.snapshot().capacity());
            assertEquals(0, e.snapshot().size());
        }
    }

    @Test
    void scenarioTracesOnlyContainArgumentsOfTheExecutedOperation() {
        assertScenarioOperations("read-replace", List.of(
                Operation.array(RESET, null, null, null),
                Operation.array(ADD, null, Element.of("A"), null),
                Operation.array(ADD, null, Element.of("B"), null),
                Operation.array(ADD, null, Element.of("C"), null),
                Operation.array(GET_AT, 1, null, null),
                Operation.array(SET_AT, 1, Element.of(42), null)));
        assertScenarioOperations("capacity", List.of(
                Operation.array(RESET, null, null, null),
                Operation.array(ENSURE_CAPACITY, null, null, 10),
                Operation.array(ADD, null, Element.of("A"), null),
                Operation.array(ENSURE_CAPACITY, null, null, 24),
                Operation.array(TRIM_TO_SIZE, null, null, null),
                Operation.array(CLEAR, null, null, null),
                Operation.array(TRIM_TO_SIZE, null, null, null),
                Operation.array(ADD, null, Element.of("B"), null)));
        assertScenarioOperations("nulls", List.of(
                Operation.array(RESET, null, null, null),
                Operation.array(ADD, null, Element.of(null), null),
                Operation.array(ADD, null, Element.of("null"), null),
                Operation.array(ADD, null, Element.of(null), null),
                Operation.array(GET_AT, 0, null, null),
                Operation.array(SET_AT, 2, Element.of(null), null),
                Operation.array(REMOVE_AT, 2, null, null)));
    }

    private static void assertScenarioOperations(String name, List<Operation> expected) {
        var trace = new ArrayListEngine().scenario(name);
        assertEquals(expected,
                trace.steps().stream().filter(s -> s.event().equals("OPERATION_STARTED")).map(Step::operation)
                        .toList());
        for (var step : trace.steps()) assertTrue(expected.contains(step.operation()), step.operation().toString());
    }

    @Test
    void extraneousElementsAreRejectedBeforeMutationIncludingTypedNull() {
        var e = new ArrayListEngine();
        add(e, "keep");
        var before = e.snapshot();
        for (var type : List.of(GET_AT, REMOVE_AT, CLEAR, RESET, ENSURE_CAPACITY, TRIM_TO_SIZE)) {
            Integer index = type == GET_AT || type == REMOVE_AT ? 0 : null;
            Integer capacity = type == ENSURE_CAPACITY ? 24 : null;
            for (var element : List.of(Element.of(null), Element.of("unexpected"))) {
                var error = assertThrows(IllegalArgumentException.class,
                        () -> e.execute(Operation.array(type, index, element, capacity)));
                assertEquals("Эта операция не принимает element", error.getMessage());
                assertEquals(before, e.snapshot());
            }
        }
    }
}
