package dev.collectionsviz.core;

import dev.collectionsviz.core.Protocol.*;

/** A new collection supplies its state type and reuses commands and trace playback. */
public interface CollectionEngine<S> {
    S snapshot();
    Trace<S> execute(Operation operation);
}
