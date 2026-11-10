package dev.collectionsviz.api.dto;

import dev.collectionsviz.core.protocol.Snapshot;
import dev.collectionsviz.core.protocol.Trace;

import java.util.UUID;

public record SessionTrace<S extends Snapshot>(int schemaVersion, UUID sessionId, long revision, Trace<S> trace) {
}
