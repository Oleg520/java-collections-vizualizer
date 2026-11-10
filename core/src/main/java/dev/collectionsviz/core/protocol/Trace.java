package dev.collectionsviz.core.protocol;

import dev.collectionsviz.core.protocol.command.Operation;
import dev.collectionsviz.core.protocol.command.Result;

import java.util.List;

public record Trace<S>(int schemaVersion, String collection, Operation operation, Result result,
                       S before, List<Step<S>> steps, S committed) {
}
