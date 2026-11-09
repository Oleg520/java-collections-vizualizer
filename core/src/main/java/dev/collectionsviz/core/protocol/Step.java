package dev.collectionsviz.core.protocol;

import dev.collectionsviz.core.protocol.command.Operation;
import java.util.Map;

public record Step<S>(int index, Operation operation, String event, String stage,
                      String message, Map<String,Object> details, S snapshot) {}
