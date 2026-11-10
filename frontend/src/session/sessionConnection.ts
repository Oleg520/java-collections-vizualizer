import { api, ApiError } from "../api/api";
import type { CollectionType, Session, SessionTrace } from "../api/types/index";

/** Route/proxy 404s do not establish that a known session has expired. */
function sessionNotFound(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === "SESSION_NOT_FOUND"
  );
}

/** One server slot per mounted tab. Even obsolete replies update the transport's
 * committed revision before the next request; only the hook selects visible state.
 */
export class SessionConnection {
  session: Session | null = null;
  needsRefresh = false;
  retryAt = 0;
  creationFailure = 0;
  private pending: Promise<void> = Promise.resolve();
  constructor(
    private transport: Pick<typeof api, "create" | "reset" | "get"> = api,
  ) {}

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    this.pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  change(
    collection: CollectionType,
    capacity: number | undefined,
    active: () => boolean,
    creationFailure = this.creationFailure,
  ) {
    return this.serialize(async () => {
      if (!active()) return null; // Coalesce switches that have not started yet.
      this.checkCooldown();
      if (!this.session && creationFailure !== this.creationFailure)
        throw new Error(
          "Предыдущее создание сессии завершилось ошибкой. Подключитесь повторно явным действием.",
        );
      if (this.needsRefresh) await this.read();
      if (!active()) return null;
      if (this.session) {
        try {
          this.session = await this.transport.reset(
            this.session,
            collection,
            capacity,
          );
          return this.session;
        } catch (e) {
          if (!sessionNotFound(e)) {
            await this.recover(e);
            if (e instanceof ApiError && e.status === 404)
              throw new ApiError(
                "API смены структуры недоступен. Проверьте совместимость версий frontend/backend и маршрут API. Существующая сессия сохранена.",
                e.status,
                e.code,
              );
            throw e;
          }
          // A missing/expired owned slot cannot have committed the reset.
          this.session = null;
        }
      }
      // A failed/lost create has no known UUID: never automatically repeat it.
      try {
        this.session = await this.transport.create(collection, capacity);
      } catch (e) {
        this.creationFailure++;
        this.recordLimit(e);
        throw e;
      }
      return this.session;
    });
  }
  execute(request: (session: Session) => Promise<SessionTrace>) {
    return this.serialize(async () => {
      this.checkCooldown();
      if (this.needsRefresh)
        throw new Error(
          "Сначала обновите состояние сессии. Результат предыдущей операции неизвестен.",
        );
      if (!this.session)
        throw new Error("Создайте сессию перед выполнением команды.");
      try {
        const response = await request(this.session);
        this.session = {
          ...this.session,
          collection: response.trace.collection,
          revision: response.revision,
          state: response.trace.committed,
        };
        return response;
      } catch (e) {
        await this.recover(e);
        throw e;
      }
    });
  }
  refresh() {
    return this.serialize(async () => {
      this.checkCooldown();
      await this.read();
      return this.session;
    });
  }
  private checkCooldown() {
    if (Date.now() < this.retryAt)
      throw new ApiError(
        "Подождите перед следующим запросом.",
        429,
        "RETRY_AFTER",
        this.retryAt,
      );
  }
  private recordLimit(error: unknown) {
    if (error instanceof ApiError)
      this.retryAt = Math.max(this.retryAt, error.retryAt);
  }
  private async read() {
    if (!this.session) return;
    try {
      this.session = await this.transport.get(this.session.id);
      this.needsRefresh = false;
    } catch (e) {
      this.recordLimit(e);
      if (sessionNotFound(e)) {
        this.session = null;
        this.needsRefresh = false;
      }
      throw e;
    }
  }
  private async recover(error: unknown) {
    this.recordLimit(error);
    if (sessionNotFound(error)) {
      this.session = null;
      this.needsRefresh = false;
      return;
    }
    if (
      !this.session ||
      (error instanceof ApiError &&
        error.status !== 0 &&
        error.status !== 409 &&
        error.status < 500)
    )
      return;
    this.needsRefresh = true;
    try {
      this.checkCooldown();
      await this.read();
    } catch {
      // Keep the UUID and block mutations until an explicit GET succeeds.
    }
  }
}
