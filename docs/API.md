# JSON API v1

Базовый путь: `/api/v1`. Машиночитаемая спецификация: [openapi.yml](openapi.yml).
Все команды принимают `Content-Type: application/json`. Ошибки:
`{"schemaVersion":1,"code":"INVALID_INPUT","message":"…"}`.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/health` | Готовность Java-сервиса |
| GET | `/scenarios` | Восемь сценариев, названия и объяснения |
| POST | `/sessions` | Новая изолированная сессия; `{}` либо `{"initialCapacity":64}` |
| GET | `/sessions/{id}` | Зафиксированный snapshot и revision |
| POST | `/sessions/{id}/commands` | Операция и полный trace |
| POST | `/sessions/{id}/scenarios/{name}` | Реальные Java-операции сценария, начиная с reset |

Пример запроса (UUID берётся из ответа создания сессии):

```json
{
  "expectedRevision": 0,
  "operation": {
    "type": "PUT",
    "key": {"type": "COLLISION", "value": "A", "hashCodeOverride": 42},
    "value": "Alpha"
  }
}
```

`PUT`, `GET`, `REMOVE` требуют `key`. Для `CLEAR` и `RESET` ключ не нужен.
`SCENARIO` встречается только в ответе сценария. `PUT` принимает строковое значение
до 128 UTF-16 code units либо JSON `null` (пропущенное value тоже означает null).
Ключ — до 64 UTF-16 code units. Пустой String разрешён, пустой учебный ID запрещён.

Типы ключей:

- `STRING`: `value` — Java String; нельзя задавать `hashCodeOverride`.
- `INTEGER`: `value` — строковая запись Java int; сервер нормализует её, например `01` и `1` — один ключ.
- `COLLISION`: `value` — ID, `hashCodeOverride` — signed int32. Hash закрепляется при первой принятой операции с ID; смена запрещена до reset, даже после remove/clear. Учебный ключ immutable и Comparable.
- `NULL`: `value` и `hashCodeOverride` отсутствуют либо null. Hash равен нулю.

Ответ команды содержит `sessionId`, новую `revision` и `trace`:

- `schemaVersion: 1`, `collection: "HASH_MAP"`, исходную `operation`;
- `result.found`, `previousValue`, `value`: found различает отсутствующую запись и запись со значением null;
- `before`: зафиксированное состояние перед операцией;
- `steps`: массив с непрерывными индексами с нуля. Каждый шаг содержит исходную команду (в том числе внутри сценария), `event`, семантический `stage`, русское `message`, `details` и полный `snapshot`;
- `committed`: итог. Последний snapshot совпадает с ним.

Одна команда, включая GET и сценарий целиком, увеличивает revision ровно на один.
`expectedRevision` обязателен и должен совпадать с текущим. Проверка и выполнение
атомарны под блокировкой сессии: из двух конкурирующих команд одной версии
выполнится одна, другая получит **409 REVISION_CONFLICT**. При 409 следует получить
актуальную сессию. При потере ответа нельзя автоматически повторять PUT/REMOVE;
сначала получите состояние через GET. Идемпотентных request IDs в MVP нет.

Сессии живут в памяти одного процесса. По умолчанию TTL = 1800 секунд без обращений,
лимит = 128 сессий. Очистка выполняется каждую минуту; доступ также проверяет TTL.
Вкладка создаёт новый UUID и не использует общий localStorage. Истёкшая/неизвестная
сессия: **404 SESSION_NOT_FOUND**. Переполнение сервера: **503 SESSION_LIMIT**.
Неверный запрос: **400 INVALID_REQUEST / INVALID_INPUT**. Ошибки валидации и
конфликты не изменяют коллекцию и revision.

## Снимки

`snapshot` содержит `phase`, `size`, фактическую `capacity`, `threshold`, `loadFactor`,
`buckets`, `pendingCapacity`, `pendingBuckets`. Сериализуются только занятые бакеты;
все остальные индексы от 0 до capacity−1 пусты. При capacity=0 массива нет.
Пока массив не выделен, threshold у конструктора с указанной ёмкостью содержит
**целевую начальную ёмкость**, как в JDK; у стандартного конструктора — 0.

Бакет: `index`, `kind` (LIST/TREE), `headId`, `rootId`, `nodes`. Узел содержит ID,
ключ, значение, rawHashCode и spread hash, ссылки `next`, `parent`, `left`, `right`,
`prev`, nullable цвет `red`, признак `linked` (есть в цепочке бакета).
`red=null` означает обычный узел; false — чёрный, true — красный. Все ссылки — ID.
ID не переиспользуются в сессии, сохраняются при resize/treeify/untreeify; удалённый
и заново вставленный ключ получает новый ID. Reset создаёт новые узлы с новыми ID.

`WORKING` — точка внутри алгоритма. Например, узел уже присоединён, но size ещё не
увеличен; корень временно красный; удаляемый узел отцеплен от next, но ещё используется
балансировкой. Это не обещание инвариантов завершённой коллекции. Дерево может временно
быть лесом. Снимки включают также достижимые узлы с `linked=false`, нужные для показа
промежуточных tree-ссылок. После завершения `phase=COMMITTED` и инварианты восстановлены.

Во время resize новая таблица находится в `buckets`, ещё не перенесённые старые
бакеты — в `pendingBuckets`. Особый `kind=TRANSFER` там же показывает узлы, уже
снятые со старой таблицы, но ещё удерживаемые локальными переменными split. Это
рабочая область, а не дополнительный бакет Java HashMap. По ID можно проследить
весь перенос. `BUCKET_SPLIT.details` содержит `fromBucket`, `toBucket`, `oldCapacity`,
`splitBit` и формулу. Узлы, достижимые через несколько промежуточных tree-ссылок,
могут встречаться в рабочих представлениях более одного бакета: renderer использует ID.

Шаги и зафиксированное состояние независимы. Воспроизведение не имеет API endpoints:
все действия над таймлайном локальны, не меняют revision и не исполняют Java повторно.

## Семантические события

| Группа | События |
|---|---|
| Операция | OPERATION_STARTED, OPERATION_COMPLETED, CONFIGURED, MAP_CLEARED, MAP_RESET |
| Hash / индекс | HASH_CALCULATED, TABLE_ABSENT, TABLE_INITIALIZED, BUCKET_SELECTED |
| Поиск / изменение | KEY_COMPARED, COLLISION, NODE_INSERTED, VALUE_UPDATED, SIZE_CHANGED, NODE_REMOVED, LOOKUP_RESULT, REMOVE_RESULT |
| Расширение | THRESHOLD_EXCEEDED, RESIZE_STARTED, TABLE_EXPANDED, BUCKET_SPLIT, RESIZE_COMPLETED |
| Дерево | TREEIFY_DEFERRED, TREEIFY_STARTED, TREEIFY_COMPLETED, TREE_VISITED, TREE_DIRECTION, TREE_RECOLORED, TREE_ROTATED, TREE_BALANCED, UNTREEIFIED |

`stage` принимает operation/hash/index/search/mutation/tree/resize и служит точкой
расширения для подсветки алгоритма. `details` — расширяемый объект, клиент должен
игнорировать неизвестные поля. В нём нет координат или длительностей анимации.

## Компактный trace без потери шагов

`POST .../commands?encoding=compact` и `POST .../scenarios/{name}?encoding=compact`
возвращают тот же результат и все события, но выносят повторяющиеся версии узлов в
таблицу `nodePool`. Frontend использует этот режим. Без параметра (или при
`encoding=full`) сохраняется исходный формат с полными узлами в каждом снимке.
Неизвестное значение encoding отклоняется **до** исполнения команды.

В компактном ответе есть `encoding: "node-table-v1"` и `nodePool: Node[]`. В каждом
бакете `trace.before`, `steps[*].snapshot` и `trace.committed` вместо `nodes`
содержится `nodeRefs: number[]` — индексы в nodePool с нуля. Все остальные поля
снимка сохраняются. Каждый снимок самодостаточен вместе с таблицей: не требуется
последовательное применение дельт или повторное исполнение алгоритма.

Индекс в nodePool **не является ID узла**. Один стабильный `Node.id` может иметь
несколько версий: до вращения и после, до изменения value и после. Идентичные
версии разделяются всеми снимками. Воспроизведение должно считать их неизменяемыми.
`frontend/src/trace.ts` разрешает ссылки и передаёт renderer обычные полные snapshots,
сохраняя общие объекты версий в памяти. Java-ядро и его интерфейс остаются независимыми
от этого способа передачи. Тест сравнивает каждый восстановленный снимок большого
split с исходным Java trace.

Сервис также поддерживает HTTP gzip для JSON-ответов размером от 1 KiB при
`Accept-Encoding: gzip`. Полный формат в предельных случаях остаётся объёмным;
для браузерного воспроизведения следует выбирать compact.

Сценарии всегда задают собственный конструктор: 64 для `treeify`, `tree-search`,
`tree-remove`; стандартный конструктор (0 → первая таблица 16) для остальных.
Это отражено в CONFIGURED (`initialCapacity`, `sessionInitialCapacity`). Сценарий
не меняет настройку обычного RESET сессии. Поэтому resize и deferred-tree дают
описанный результат при любой исходной ёмкости сессии.

KEY_COMPARED различает `identityEqual` (результат `==`) и `equalsChecked` (был ли
реальный вызов equals с учётом short-circuit). Для совпавших null-ключей equals
не вызывается.
