package dev.collectionsviz.core.collections.arraylist;

import java.util.List;

public record Buffer(long id, int capacity, List<Cell> cells) {
}
