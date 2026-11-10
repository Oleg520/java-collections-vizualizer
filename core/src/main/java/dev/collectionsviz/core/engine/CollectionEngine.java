package dev.collectionsviz.core.engine;

import dev.collectionsviz.core.protocol.Trace;
import dev.collectionsviz.core.protocol.command.Operation;

/**
 * A new collection supplies its state type and reuses commands and trace playback.
 */
public interface CollectionEngine<S> {
    S snapshot();

    Trace<S> scenario(String name);

    Trace<S> execute(Operation operation);
}
