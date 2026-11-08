import { api, ApiError } from "./api";
import type { CollectionType, Session, SessionTrace } from "./types";

/** One server slot per mounted tab. Even obsolete replies update the transport's
 * committed revision before the next request; only the hook selects visible state.
 */
export class SessionConnection {
  session: Session | null = null;
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
  ) {
    return this.serialize(async () => {
      if (!active()) return null; // Coalesce switches that have not started yet.
      if (this.session) {
        try {
          this.session = await this.transport.reset(
            this.session,
            collection,
            capacity,
          );
          return this.session;
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 404) {
            await this.recover(e);
            throw e;
          }
          // A missing/expired owned slot cannot have committed the reset.
          this.session = null;
        }
      }
      // A failed/lost create has no known UUID: never automatically repeat it.
      this.session = await this.transport.create(collection, capacity);
      return this.session;
    });
  }
  execute(request: (session: Session) => Promise<SessionTrace>) {
    return this.serialize(async () => {
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
  private async recover(error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      this.session = null;
      return;
    }
    if (
      !this.session ||
      !(error instanceof ApiError) ||
      ![0, 409].includes(error.status)
    )
      return;
    try {
      this.session = await this.transport.get(this.session.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.session = null;
      // Preserve the original error, never repeat an uncertain mutation.
    }
  }
}
