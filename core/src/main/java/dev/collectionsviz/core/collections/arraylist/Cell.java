package dev.collectionsviz.core.collections.arraylist;

import dev.collectionsviz.core.protocol.command.Element;

/** IDs identify teaching occurrences, never Java object addresses. */
public record Cell(long id, Element element) {}
