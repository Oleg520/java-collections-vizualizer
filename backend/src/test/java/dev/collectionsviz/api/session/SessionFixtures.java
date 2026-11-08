package dev.collectionsviz.api.session;

public final class SessionFixtures {
    private SessionFixtures() {}
    public static SessionStore store(long ttl, int maximum, java.time.Clock clock) { return new SessionStore(ttl, maximum, clock); }
    public static SessionStore store(long ttl, int maximum, int perClient, java.time.Clock clock) { return new SessionStore(ttl, maximum, perClient, clock); }
}
