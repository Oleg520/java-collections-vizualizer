package dev.collectionsviz.api.dto;

import dev.collectionsviz.core.protocol.Trace;

/** Common metadata for compact response observation. */
public interface CompactTraceResponse {
    Trace<?> trace();
}
