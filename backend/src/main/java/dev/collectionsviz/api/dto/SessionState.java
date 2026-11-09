package dev.collectionsviz.api.dto;

import dev.collectionsviz.core.protocol.Snapshot;
import java.util.UUID;

public record SessionState(int schemaVersion, UUID id, String collection, long revision, long expiresInSeconds, Snapshot state) {}
