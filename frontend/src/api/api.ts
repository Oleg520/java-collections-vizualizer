import { validatePhysicalSnapshot } from "./trace/hashmap";
import { isArray } from "./types";
import {
  decodeTrace,
  type CompactArrayTrace,
  type CompactSessionTrace,
} from "./trace/decodeTrace";
import type {
  CollectionType,
  Operation,
  Scenario,
  Session,
} from "./types/index";
const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public retryAt = 0,
    public reason?: string,
    public params?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export function retryDeadline(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  const deadline = Number.isFinite(seconds)
    ? now + seconds * 1000
    : Date.parse(value);
  return Number.isFinite(deadline) ? Math.max(now, deadline) : 0;
}

function apiMessage(status: number, code: string, message: unknown): string {
  if (status === 409)
    return "Состояние изменилось. Получаем актуальную версию; команда не повторяется.";
  if (code === "SESSION_NOT_FOUND")
    return "Сессия истекла или Java-сервис перезапущен. Создайте новую сессию. Прежнее состояние сервера недоступно.";
  if (status === 429)
    return code === "CLIENT_SESSION_LIMIT"
      ? "Достигнут лимит активных сессий. Дождитесь освобождения сессий; команда не выполнена."
      : "Слишком много запросов или Java-сервис занят. Подождите перед следующим действием; команда не выполнена.";
  if (status === 503)
    return code === "SESSION_LIMIT"
      ? "Java-сервис занят: достигнут лимит сессий. Попробуйте подключиться позже."
      : "Java-сервис временно недоступен. Обновите состояние перед продолжением.";
  if (status === 404)
    return "Маршрут API недоступен. Проверьте совместимость версий frontend/backend и адрес API. Существующая сессия сохранена.";
  return typeof message === "string"
    ? message
    : `Ошибка API: ${status}. Попробуйте обновить состояние.`;
}

async function request<T>(path: string, data?: unknown): Promise<T> {
  try {
    if (data !== undefined && path.includes("snapshotVersion=2")) {
      const health = await request<{ hashMapSnapshotVersion?: string }>(
        "/health",
      );
      if (health.hashMapSnapshotVersion !== "2")
        throw new ApiError(
          "Несовместимый backend. Обновите backend и страницу; команда не отправлена.",
          426,
          "API_VERSION_MISMATCH",
        );
    }
    const response = await fetch(`${base}/api/v1${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers:
        data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    });
    // The same deadline covers headers AND the response body.
    const retryAt = retryDeadline(response.headers.get("Retry-After"));
    let body: string;
    try {
      body = await response.text();
    } catch (error) {
      // Known HTTP rejection headers remain useful even when its body is lost.
      if (!response.ok)
        throw new ApiError(
          apiMessage(response.status, "HTTP_ERROR", null),
          response.status,
          "HTTP_ERROR",
          retryAt,
        );
      throw error;
    }
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const code =
        typeof payload?.code === "string" ? payload.code : "HTTP_ERROR";
      throw new ApiError(
        apiMessage(response.status, code, payload?.message),
        response.status,
        code,
        retryAt,
        typeof payload?.reason === "string" ? payload.reason : undefined,
        payload?.params &&
        typeof payload.params === "object" &&
        !Array.isArray(payload.params)
          ? payload.params
          : undefined,
      );
    }
    if (payload === null)
      throw new ApiError(
        "API вернул некорректный JSON. Обновите состояние перед продолжением.",
        0,
        "INVALID_RESPONSE",
      );
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Нет ответа от Java-сервиса. Проверьте соединение и обновите состояние. Результат операции может быть неизвестен; она не будет повторена автоматически.",
      0,
      "NETWORK_ERROR",
    );
  }
}
const versionQuery = (collection: string) =>
  collection === "HASH_MAP" ? "snapshotVersion=2" : "snapshotVersion=1";
function checkedSession(session: Session): Session {
  if (session.collection === "HASH_MAP" && session.schemaVersion !== 2)
    throw new ApiError(
      "Несовместимая версия HashMap API; обновите backend. Операция не повторяется.",
      0,
      "INCOMPATIBLE_RESPONSE",
    );
  if (!isArray(session.state)) validatePhysicalSnapshot(session.state);
  return session;
}
export const api = {
  create: (collection: CollectionType = "HASH_MAP", initialCapacity?: number) =>
    request<Session>(`/sessions?${versionQuery(collection)}`, {
      collection,
      initialCapacity,
    }).then(checkedSession),
  reset: (
    session: Session,
    collection: CollectionType,
    initialCapacity?: number,
  ) =>
    request<Session>(`/sessions/${session.id}/reset?snapshotVersion=2`, {
      expectedRevision: session.revision,
      collection,
      initialCapacity,
    }).then(checkedSession),
  get: (id: string, collection: string = "HASH_MAP") =>
    request<Session>(`/sessions/${id}?${versionQuery(collection)}`).then(
      checkedSession,
    ),
  scenarios: (collection: CollectionType = "HASH_MAP") =>
    request<Scenario[]>(`/scenarios?collection=${collection}`),
  command: (session: Session, operation: Operation) =>
    request<CompactSessionTrace | CompactArrayTrace>(
      `/sessions/${session.id}/commands?encoding=compact&${versionQuery(session.collection)}`,
      {
        expectedRevision: session.revision,
        operation,
      },
    ).then((response) => {
      if (
        session.collection === "HASH_MAP" &&
        response.encoding !== "node-table-v2"
      )
        throw new ApiError(
          "Несовместимая версия HashMap trace; обновите состояние. Команда не повторяется.",
          0,
          "INCOMPATIBLE_RESPONSE",
        );
      return decodeTrace(response);
    }),
  scenario: (session: Session, name: string) =>
    request<CompactSessionTrace | CompactArrayTrace>(
      `/sessions/${session.id}/scenarios/${name}?encoding=compact&${versionQuery(session.collection)}`,
      {
        expectedRevision: session.revision,
      },
    ).then((response) => {
      if (
        session.collection === "HASH_MAP" &&
        response.encoding !== "node-table-v2"
      )
        throw new ApiError(
          "Несовместимая версия HashMap trace; обновите состояние. Команда не повторяется.",
          0,
          "INCOMPATIBLE_RESPONSE",
        );
      return decodeTrace(response);
    }),
};
