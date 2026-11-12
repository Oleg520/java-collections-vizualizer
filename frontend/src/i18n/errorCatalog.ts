export const errorRu = {
  "errors.request":
    "Не удалось выполнить запрос. Обновите состояние перед продолжением.",
  "errors.conflict":
    "Состояние изменилось. Получаем актуальную версию; команда не повторяется.",
  "errors.expired":
    "Сессия истекла или Java-сервис перезапущен. Создайте новую сессию. Прежнее состояние сервера недоступно.",
  "errors.clientSessions":
    "Достигнут лимит активных сессий. Дождитесь освобождения сессий; команда не выполнена.",
  "errors.rate":
    "Слишком много запросов или Java-сервис занят. Подождите перед следующим действием; команда не выполнена.",
  "errors.sessionLimit":
    "Java-сервис занят: достигнут лимит сессий. Попробуйте подключиться позже.",
  "errors.unavailable":
    "Java-сервис временно недоступен. Обновите состояние перед продолжением.",
  "errors.route":
    "Маршрут API недоступен. Проверьте совместимость версий frontend/backend и адрес API. Существующая сессия сохранена.",
  "errors.network":
    "Нет ответа от Java-сервиса. Проверьте соединение и обновите состояние. Результат операции может быть неизвестен; она не будет повторена автоматически.",
  "errors.version":
    "Несовместимый backend. Обновите backend и страницу; команда не отправлена.",
  "errors.response":
    "API вернул некорректный ответ. Обновите состояние перед продолжением.",
  "errors.input":
    "Проверьте аргументы операции, их типы и допустимые диапазоны.",
  "errors.malformed":
    "Проверьте JSON, типы полей, UUID и expectedRevision ≥ 0.",
  "errors.fullTrace": "Полный trace отключён. Используйте encoding=compact.",
  "errors.refreshRequired":
    "Актуальное состояние пока не получено. Обновите состояние перед следующей командой.",
  "errors.createFailed":
    "Предыдущее создание сессии завершилось ошибкой. Подключитесь повторно явным действием.",
  "errors.createRequired": "Создайте сессию перед выполнением команды.",
  "errors.wait": "Подождите перед следующим запросом.",
  "errors.localUnknown": "Неизвестный локальный split",
  "errors.localStopped": "Локальный сценарий остановлен",
  "errors.corruptReference": "Повреждённая ссылка в trace",
  "errors.corruptBuffer": "Повреждённый буфер trace",
  "errors.corruptObject": "Повреждённый objectId в trace",
  "errors.traceVersion": "Несовместимая версия HashMap trace",
  "errors.ambiguousObject": "Неоднозначный objectId в snapshot",
  "errors.corruptLink": "Повреждённая физическая ссылка snapshot",
  "errors.traceFormat": "Неизвестный формат trace",
  "recovery.create": "Новая сессия",
  "recovery.reconnect": "Повторить подключение",
  "recovery.refresh": "Обновить состояние",
  "validation.HASHMAP_INITIAL_CAPACITY":
    "Начальная ёмкость: 16, 32 или 64 (0 — стандартный конструктор)",
  "validation.KEY_TYPE_REQUIRED": "Укажите тип ключа",
  "validation.NULL_KEY_FIELDS": "NULL-ключ не имеет value/hashCode",
  "validation.KEY_LENGTH": "Ключ должен содержать до {limit} символов",
  "validation.HASH_OVERRIDE_TYPE":
    "hashCode задаётся только для учебного ключа",
  "validation.INTEGER_RANGE":
    "Integer: целое число от −2147483648 до 2147483647",
  "validation.TEACHING_KEY_REQUIRED": "Учебному ключу нужны ID и hashCode",
  "validation.HASH_ALREADY_ASSIGNED":
    "hashCode этого ID уже закреплён: {hashCode}. Выполните reset для смены.",
  "validation.TEACHING_ID_LIMIT": "Лимит {limit} учебных ID; выполните reset",
  "validation.UNKNOWN_KEY": "Неизвестный ключ",
  "validation.HASHMAP_OPERATION":
    "Допустимые операции: PUT, GET, REMOVE, CLEAR, RESET",
  "validation.HASHMAP_ARGUMENTS": "HashMap не принимает поля ArrayList",
  "validation.VALUE_LENGTH": "Значение: до {limit} символов",
  "validation.SIZE_LIMIT": "Учебный лимит: {limit} элементов",
  "validation.UNKNOWN_SCENARIO": "Неизвестный сценарий",
  "validation.ARRAY_INITIAL_CAPACITY":
    "Начальная ёмкость: 0..{limit}; отсутствие — стандартный конструктор",
  "validation.ELEMENT_TYPE_REQUIRED":
    "Укажите element с типом STRING, INTEGER или NULL",
  "validation.NULL_ELEMENT_VALUE": "NULL не имеет значения",
  "validation.CAPACITY_LIMIT":
    "Учебный лимит capacity: {limit}; вычисленный рост: {capacity}",
  "validation.ARRAY_OPERATION": "Укажите допустимую операцию ArrayList",
  "validation.ARRAY_ARGUMENTS":
    "ArrayList использует index и element, а не key/value",
  "validation.UNEXPECTED_ELEMENT": "Эта операция не принимает element",
  "validation.UNEXPECTED_INDEX": "Эта операция не принимает index",
  "validation.INDEX_RANGE": "Индекс вне диапазона: {index}; size = {size}",
  "validation.MIN_CAPACITY_REQUIRED": "Укажите minCapacity (Java int)",
} as const;
export const errorEn: Record<keyof typeof errorRu, string> = {
  "errors.request": "The request failed. Refresh the state before continuing.",
  "errors.conflict":
    "State changed. Fetching the current version; the command is not repeated.",
  "errors.expired":
    "The session expired or the Java service restarted. Create a new session. The previous server state is unavailable.",
  "errors.clientSessions":
    "Active session limit reached. Wait for sessions to expire; the command was not executed.",
  "errors.rate":
    "Too many requests or the Java service is busy. Wait before the next action; the command was not executed.",
  "errors.sessionLimit":
    "Java service busy: session limit reached. Try connecting later.",
  "errors.unavailable":
    "The Java service is temporarily unavailable. Refresh the state before continuing.",
  "errors.route":
    "API route unavailable. Check frontend/backend compatibility and the API address. The existing session is retained.",
  "errors.network":
    "No response from the Java service. Check the connection and refresh the state. The operation outcome may be unknown; it will not be repeated automatically.",
  "errors.version":
    "Incompatible backend. Update the backend and reload the page; the command was not sent.",
  "errors.response":
    "The API returned an invalid response. Refresh the state before continuing.",
  "errors.input": "Check operation arguments, their types and allowed ranges.",
  "errors.malformed": "Check JSON, field types, UUID and expectedRevision ≥ 0.",
  "errors.fullTrace": "Full trace is disabled. Use encoding=compact.",
  "errors.refreshRequired":
    "Current state has not been obtained. Refresh the state before the next command.",
  "errors.createFailed":
    "Previous session creation failed. Reconnect explicitly.",
  "errors.createRequired": "Create a session before executing a command.",
  "errors.wait": "Wait before the next request.",
  "errors.localUnknown": "Unknown local split",
  "errors.localStopped": "Local scenario stopped",
  "errors.corruptReference": "Corrupt trace reference",
  "errors.corruptBuffer": "Corrupt trace buffer",
  "errors.corruptObject": "Corrupt objectId in trace",
  "errors.traceVersion": "Incompatible HashMap trace version",
  "errors.ambiguousObject": "Ambiguous snapshot objectId",
  "errors.corruptLink": "Corrupt physical snapshot reference",
  "errors.traceFormat": "Unknown trace format",
  "recovery.create": "New session",
  "recovery.reconnect": "Reconnect",
  "recovery.refresh": "Refresh state",
  "validation.HASHMAP_INITIAL_CAPACITY":
    "Initial capacity: 16, 32 or 64 (0 means the default constructor)",
  "validation.KEY_TYPE_REQUIRED": "Specify the key type",
  "validation.NULL_KEY_FIELDS": "A NULL key has no value/hashCode",
  "validation.KEY_LENGTH": "The key must contain at most {limit} characters",
  "validation.HASH_OVERRIDE_TYPE":
    "hashCode can only be set for a teaching key",
  "validation.INTEGER_RANGE":
    "Integer: a whole number from −2147483648 to 2147483647",
  "validation.TEACHING_KEY_REQUIRED":
    "A teaching key requires an ID and hashCode",
  "validation.HASH_ALREADY_ASSIGNED":
    "This ID already has hashCode {hashCode}. Use reset to change it.",
  "validation.TEACHING_ID_LIMIT": "Limit of {limit} teaching IDs; use reset",
  "validation.UNKNOWN_KEY": "Unknown key",
  "validation.HASHMAP_OPERATION":
    "Supported operations: PUT, GET, REMOVE, CLEAR, RESET",
  "validation.HASHMAP_ARGUMENTS": "HashMap does not accept ArrayList fields",
  "validation.VALUE_LENGTH": "Value: at most {limit} characters",
  "validation.SIZE_LIMIT": "Teaching limit: {limit} elements",
  "validation.UNKNOWN_SCENARIO": "Unknown scenario",
  "validation.ARRAY_INITIAL_CAPACITY":
    "Initial capacity: 0..{limit}; omit for the default constructor",
  "validation.ELEMENT_TYPE_REQUIRED":
    "Specify element with type STRING, INTEGER or NULL",
  "validation.NULL_ELEMENT_VALUE": "NULL has no value",
  "validation.CAPACITY_LIMIT":
    "Teaching capacity limit: {limit}; calculated growth: {capacity}",
  "validation.ARRAY_OPERATION": "Specify a supported ArrayList operation",
  "validation.ARRAY_ARGUMENTS":
    "ArrayList uses index and element, rather than key/value",
  "validation.UNEXPECTED_ELEMENT": "This operation does not accept element",
  "validation.UNEXPECTED_INDEX": "This operation does not accept index",
  "validation.INDEX_RANGE": "Index out of bounds: {index}; size = {size}",
  "validation.MIN_CAPACITY_REQUIRED": "Specify minCapacity (Java int)",
};
