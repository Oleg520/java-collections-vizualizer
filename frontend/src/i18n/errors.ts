import { errorRu } from "./errorCatalog";
import type { MessageKey } from "./catalog";
import { russian, type Params, type Translator } from "./locale";
export interface Message {
  key: MessageKey;
  params?: Params;
}
export type DisplayError =
  | Message
  | { cause: unknown; refresh?: boolean; expired?: boolean };
/** Local errors retain a stable key; Error.message remains useful to diagnostics. */
export class ClientError extends Error implements Message {
  constructor(
    public key: MessageKey,
    public params?: Params,
  ) {
    super(russian(key, params));
  }
}
function causeText(t: Translator, cause: unknown): string {
  if (cause instanceof ClientError) return t(cause.key, cause.params);
  const e = cause as {
    code?: string;
    status?: number;
    reason?: string;
    params?: Params;
  } | null;
  if (!e || typeof e !== "object") return t("errors.request");
  if (e.code === "INVALID_INPUT") {
    const key = `validation.${e.reason}`;
    return Object.hasOwn(errorRu, key)
      ? t(key as MessageKey, e.params)
      : t("errors.input");
  }
  const keys: Record<string, MessageKey> = {
    SESSION_NOT_FOUND: "errors.expired",
    REVISION_CONFLICT: "errors.conflict",
    CLIENT_SESSION_LIMIT: "errors.clientSessions",
    SESSION_LIMIT: "errors.sessionLimit",
    RATE_LIMITED: "errors.rate",
    WORK_LIMIT: "errors.rate",
    CLIENT_TRACKING_LIMIT: "errors.rate",
    RETRY_AFTER: "errors.wait",
    NETWORK_ERROR: "errors.network",
    INVALID_RESPONSE: "errors.response",
    INCOMPATIBLE_RESPONSE: "errors.response",
    API_VERSION_MISMATCH: "errors.version",
    INVALID_REQUEST: "errors.malformed",
    FULL_TRACE_DISABLED: "errors.fullTrace",
  };
  const key = e.code && Object.hasOwn(keys, e.code) ? keys[e.code] : undefined;
  if (key) return t(key);
  return t(
    e.status === 409
      ? "errors.conflict"
      : e.status === 429
        ? "errors.rate"
        : e.status === 404
          ? "errors.route"
          : (e.status ?? 0) >= 500
            ? "errors.unavailable"
            : "errors.request",
  );
}
export function errorText(t: Translator, error: DisplayError): string {
  if ("key" in error) return t(error.key, error.params);
  const text = error.expired ? t("errors.expired") : causeText(t, error.cause);
  return error.refresh ? `${text} ${t("errors.refreshRequired")}` : text;
}
