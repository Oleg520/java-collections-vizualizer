package dev.collectionsviz.api;

import dev.collectionsviz.core.Protocol.Trace;

/** Common metadata for compact response observation. */
public interface CompactTraceResponse {
    Trace<?> trace();
}
