import { expect, it, vi } from "vitest";
import { SessionConnection } from "./sessionConnection";
import { ApiError } from "./api";
import type { CollectionType, Session, SessionTrace } from "./types";
const session = (
  collection: CollectionType = "HASH_MAP",
  revision = 0,
  id = "tab",
): Session => ({
  schemaVersion: 1,
  id,
  collection,
  revision,
  expiresInSeconds: 60,
  state: {
    phase: "COMMITTED",
    size: 0,
    capacity: 0,
    threshold: 0,
    loadFactor: 0.75,
    pendingCapacity: 0,
    buckets: [],
    pendingBuckets: [],
  },
});
const transport = () => ({
  create: vi.fn(
    async (collection: CollectionType = "HASH_MAP", _capacity?: number) =>
      session(collection),
  ),
  reset: vi.fn(
    async (s: Session, collection: CollectionType, _capacity?: number) =>
      session(collection, s.revision + 1, s.id),
  ),
  get: vi.fn(async (id: string) => session("HASH_MAP", 10, id)),
});
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
it("uses one slot for repeated switches and new constructor choices", async () => {
  const t = transport(),
    c = new SessionConnection(t);
  await c.change("HASH_MAP", undefined, () => true);
  for (let i = 0; i < 40; i++)
    await c.change(
      i % 2 ? "HASH_MAP" : "ARRAY_LIST",
      i % 2 ? undefined : 0,
      () => true,
    );
  expect(t.create).toHaveBeenCalledTimes(1);
  expect(t.reset).toHaveBeenCalledTimes(40);
  expect(c.session?.revision).toBe(40);
  expect(t.reset.mock.calls.every(([s]) => s.id === "tab")).toBe(true);
  expect(t.reset.mock.calls[0][2]).toBe(0);
});
it("retains an obsolete create reply, coalesces queued switches and serializes reset", async () => {
  const t = transport(),
    c = new SessionConnection(t),
    create = deferred<Session>();
  t.create.mockReturnValueOnce(create.promise);
  const first = c.change("HASH_MAP", undefined, () => true);
  await Promise.resolve();
  const obsolete = c.change("ARRAY_LIST", 0, () => false);
  const latest = c.change("ARRAY_LIST", 5, () => true);
  create.resolve(session());
  await first;
  expect(await obsolete).toBeNull();
  await latest;
  expect(t.create).toHaveBeenCalledTimes(1);
  expect(t.reset).toHaveBeenCalledTimes(1);
  expect(t.reset.mock.calls[0][2]).toBe(5);
  expect(c.session?.collection).toBe("ARRAY_LIST");
});
it("commits an old in-flight command revision before a queued collection change", async () => {
  const t = transport(),
    c = new SessionConnection(t);
  await c.change("HASH_MAP", undefined, () => true);
  const result = deferred<SessionTrace>();
  const command = c.execute(() => result.promise);
  const change = c.change("ARRAY_LIST", undefined, () => true);
  result.resolve({
    schemaVersion: 1,
    sessionId: "tab",
    revision: 7,
    trace: { collection: "HASH_MAP", committed: session().state },
  } as SessionTrace);
  await command;
  await change;
  expect(t.reset.mock.calls[0][0].revision).toBe(7);
  expect(c.session?.revision).toBe(8);
});
it.each([0, 409])(
  "recovers uncertain reset (%s) without retrying or creating a slot",
  async (status) => {
    const t = transport(),
      c = new SessionConnection(t);
    await c.change("HASH_MAP", undefined, () => true);
    t.reset.mockRejectedValueOnce(new ApiError("uncertain", status, "ERROR"));
    t.get.mockResolvedValueOnce(session("ARRAY_LIST", 1));
    await expect(c.change("ARRAY_LIST", 0, () => true)).rejects.toThrow(
      "uncertain",
    );
    expect(t.create).toHaveBeenCalledTimes(1);
    expect(t.reset).toHaveBeenCalledTimes(1);
    expect(c.session?.revision).toBe(1);
    await c.change("HASH_MAP", undefined, () => true);
    expect(t.reset.mock.calls[1][0].revision).toBe(1);
  },
);
it("replaces an expired slot once and does not automatically retry lost creation", async () => {
  const t = transport(),
    c = new SessionConnection(t);
  await c.change("HASH_MAP", undefined, () => true);
  t.reset.mockRejectedValueOnce(
    new ApiError("expired", 404, "SESSION_NOT_FOUND"),
  );
  t.create.mockResolvedValueOnce(session("ARRAY_LIST", 0, "replacement"));
  await c.change("ARRAY_LIST", 0, () => true);
  expect(c.session?.id).toBe("replacement");
  expect(t.create).toHaveBeenCalledTimes(2);
  const lost = transport(),
    other = new SessionConnection(lost);
  lost.create.mockRejectedValueOnce(new ApiError("lost", 0, "NETWORK_ERROR"));
  await expect(other.change("HASH_MAP", undefined, () => true)).rejects.toThrow(
    "lost",
  );
  expect(lost.create).toHaveBeenCalledTimes(1);
  expect(other.session).toBeNull();
});
it("preserves a slot on 429 and never retries a failed mutation", async () => {
  const t = transport(),
    c = new SessionConnection(t);
  await c.change("HASH_MAP", undefined, () => true);
  const request = vi
    .fn()
    .mockRejectedValue(new ApiError("limit", 429, "RATE_LIMITED"));
  await expect(c.execute(request)).rejects.toThrow("limit");
  expect(request).toHaveBeenCalledTimes(1);
  expect(t.get).not.toHaveBeenCalled();
  expect(c.session?.revision).toBe(0);
});

it.each(["HTTP_ERROR", "NOT_FOUND", "UNKNOWN"])(
  "preserves a known UUID when reset returns generic 404 (%s)",
  async (code) => {
    const t = transport(),
      c = new SessionConnection(t);
    await c.change("HASH_MAP", undefined, () => true);
    const original = c.session;
    t.reset.mockRejectedValue(new ApiError("Not Found", 404, code));
    for (let i = 0; i < 3; i++)
      await expect(c.change("ARRAY_LIST", 0, () => true)).rejects.toThrow(
        "совместимость версий",
      );
    expect(c.session).toBe(original);
    expect(t.create).toHaveBeenCalledTimes(1);
    expect(t.reset).toHaveBeenCalledTimes(3);
    expect(t.get).not.toHaveBeenCalled();
  },
);
it.each(["command", "recovery"])(
  "does not retire a UUID on a generic %s 404",
  async (source) => {
    const t = transport(),
      c = new SessionConnection(t);
    await c.change("HASH_MAP", undefined, () => true);
    const original = c.session;
    t.get.mockRejectedValueOnce(
      new ApiError("route missing", 404, "HTTP_ERROR"),
    );
    const error = new ApiError(
      "failed",
      source === "command" ? 404 : 0,
      "HTTP_ERROR",
    );
    await expect(c.execute(() => Promise.reject(error))).rejects.toBe(error);
    expect(c.session).toBe(original);
    t.reset.mockRejectedValueOnce(
      new ApiError("reset unsupported", 404, "HTTP_ERROR"),
    );
    await expect(c.change("ARRAY_LIST", 0, () => true)).rejects.toThrow(
      "совместимость версий",
    );
    expect(t.create).toHaveBeenCalledTimes(1);
  },
);
it("retires a UUID on confirmed expiry during command recovery", async () => {
  const t = transport(),
    c = new SessionConnection(t);
  await c.change("HASH_MAP", undefined, () => true);
  t.get.mockRejectedValueOnce(
    new ApiError("expired", 404, "SESSION_NOT_FOUND"),
  );
  await expect(
    c.execute(() => Promise.reject(new ApiError("lost", 0, "NETWORK_ERROR"))),
  ).rejects.toThrow("lost");
  expect(c.session).toBeNull();
  expect(t.create).toHaveBeenCalledTimes(1);
});
