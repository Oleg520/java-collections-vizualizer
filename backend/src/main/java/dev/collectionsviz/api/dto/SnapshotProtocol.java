package dev.collectionsviz.api.dto;

import dev.collectionsviz.api.error.ApiException;

/** Required on HashMap writes/reads. Old open tabs must reload before any mutation. */
public final class SnapshotProtocol {
    private SnapshotProtocol() {}
    public static void require(int version,String collection) {
        if ((collection.equals("HASH_MAP") && version!=2) ||
            (!collection.equals("HASH_MAP") && version!=0 && version!=1 && version!=2))
            throw new ApiException(426,"API_VERSION_MISMATCH",
                "Версия HashMap API несовместима. Обновите страницу после обновления backend. Команда не выполнена.");
    }
}
