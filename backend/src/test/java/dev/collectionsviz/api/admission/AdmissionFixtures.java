package dev.collectionsviz.api.admission;

public final class AdmissionFixtures {
    private AdmissionFixtures() {
    }

    public static ApiAdmission admission(int window, int creations, int work, int tracked, int global, int client,
                                         java.time.Clock clock) {
        return new ApiAdmission(window, creations, work, tracked, global, client, clock);
    }
}
