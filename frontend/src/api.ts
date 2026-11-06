import type { Operation, Scenario, Session, SessionTrace } from "./types";
const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
async function request<T>(path: string, data?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers:
        data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(
      "Нет ответа от Java-сервиса. Проверьте соединение и адрес API. Первый запуск сервиса может занять до минуты.",
      0,
      "NETWORK_ERROR",
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      payload?.message ?? `Ошибка API: ${response.status}`,
      response.status,
      payload?.code ?? "HTTP_ERROR",
    );
  if (payload === null)
    throw new ApiError("API вернул некорректный JSON", 0, "INVALID_RESPONSE");
  return payload as T;
}
export const api = {
  create: () => request<Session>("/sessions", {}),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  scenarios: () => request<Scenario[]>("/scenarios"),
  command: (session: Session, operation: Operation) =>
    request<SessionTrace>(`/sessions/${session.id}/commands`, {
      expectedRevision: session.revision,
      operation,
    }),
  scenario: (session: Session, name: string) =>
    request<SessionTrace>(`/sessions/${session.id}/scenarios/${name}`, {
      expectedRevision: session.revision,
    }),
};
