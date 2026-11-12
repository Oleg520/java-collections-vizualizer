package dev.collectionsviz.core.protocol;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Machine-readable validation context; human-readable messages remain compatible.
 */
public final class InputException extends IllegalArgumentException {
    private final String reason;
    private final Map<String, Object> params;

    public InputException(String reason, String message, Object... pairs) {
        super(message);
        this.reason = reason;
        var values = new LinkedHashMap<String, Object>();
        for (int i = 0; i < pairs.length; i += 2) values.put((String) pairs[i], pairs[i + 1]);
        this.params = Collections.unmodifiableMap(values);
    }

    public String reason() {
        return reason;
    }

    public Map<String, Object> params() {
        return params;
    }
}
