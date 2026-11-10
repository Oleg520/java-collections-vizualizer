package dev.collectionsviz.api.admission;

import java.net.InetAddress;
import java.util.*;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ClientAddress {
    public static final String HEADER = "X-JCV-Client-IP";
    private final Set<String> proxies = new HashSet<>();

    public ClientAddress(@Value("${visualizer.trusted-proxies:}") String trustedProxies) {
        for (String value : trustedProxies.split(",")) {
            if (value.isBlank()) continue;
            String ip = literal(value.trim());
            if (ip == null) throw new IllegalArgumentException("Trusted proxies must be exact IP literals");
            proxies.add(ip);
        }
    }

    public String resolve(HttpServletRequest request) {
        String peer = literal(request.getRemoteAddr());
        if (peer == null) return "unknown";
        if (proxies.contains(peer)) {
            var headers = Collections.list(request.getHeaders(HEADER));
            if (headers.size() == 1) {
                String client = literal(headers.get(0));
                if (client != null) return client;
            }
        }
        return peer; // Missing/invalid proxy data conservatively shares the socket identity.
    }

    static String literal(String value) {
        if (value == null || value.length() > 45) return null;
        try {
            if (value.contains(":")) {
                if (!value.matches("[0-9a-fA-F:.]+")) return null;
            } else {
                if (!value.matches("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+")) return null;
                for (String part : value.split("\\."))
                    if (part.length() > 3 || Integer.parseInt(part) > 255) return null;
            }
            // The checks above restrict this to numeric literals, so no DNS lookup is possible.
            return InetAddress.getByName(value).getHostAddress();
        } catch (Exception invalid) {
            return null;
        }
    }
}
