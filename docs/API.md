# JSON API v1

Базовый путь: `/api/v1`. Машиночитаемая спецификация: [openapi.yml](openapi.yml).
Все команды принимают `Content-Type: application/json`. Ошибки:
`{"schemaVersion":1,"code":"INVALID_INPUT","message":"…"}`.

Создание сессий, команды/сценарии и чтение снимков ограничены по IP, числу живых
сессий и одновременной работе. **429** возвращает `Retry-After` в секундах и код
`RATE_LIMITED`, `WORK_LIMIT`, `CLIENT_TRACKING_LIMIT` либо `CLIENT_SESSION_LIMIT`;
команда не исполняется, revision не меняется. Health и OPTIONS не ограничиваются.
Подробности и безопасная настройка Caddy: [API_SECURITY.md](API_SECURITY.md).

Для команд и сценариев указывайте `?encoding=compact`: full по умолчанию отключён.
Правила и диагностический режим описаны в разделе компактного trace ниже.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/health` | Готовность Java-сервиса |
| GET | `/scenarios` | Сценарии выбранной collection (HASH_MAP по умолчанию) |
| POST | `/sessions` | Новая изолированная сессия; collection и initialCapacity |
| GET | `/sessions/{id}` | Зафиксированный snapshot и revision |
| POST | `/sessions/{id}/commands` | Операция и trace выбранного формата |
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

## Снимки HashMap

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
таблицу `nodePool`. Frontend использует этот режим, доступный при любой конфигурации.

Полный формат **по умолчанию запрещён**: `ALLOW_FULL_TRACE=false` (Spring property
`visualizer.allow-full-trace`). Это относится к обоим POST endpoints и ко всем
операциям, включая GET, CLEAR/RESET и сценарии. Без параметра encoding по-прежнему
выбирается `full`, чтобы не менять формат ответа существующих клиентов молча.
При запрещённом full как явный `encoding=full`, так и отсутствие encoding дают
**403 FULL_TRACE_DISABLED**:

```json
{"schemaVersion":1,"code":"FULL_TRACE_DISABLED","message":"Полный trace отключён. Используйте encoding=compact."}
```

После допуска по ограничениям нагрузки проверка выполняется **до** доступа к движку и проверки revision: отклонённая
команда не генерирует trace, не меняет коллекцию и не увеличивает revision.
Клиент может отправить ту же команду с `encoding=compact` и прежней revision
(если её не успела изменить другая команда). Неизвестный encoding по-прежнему
даёт **400 INVALID_INPUT** до исполнения, независимо от настройки full.

Для локальной диагностики явно разрешите исходный полный формат:

```bash
ALLOW_FULL_TRACE=true java -jar "$(sh scripts/backend-jar.sh)"
```

В этом режиме отсутствие encoding и `encoding=full` возвращают прежний JSON с
полными узлами в каждом снимке, без изменения контракта. Это разрешение действует
на весь процесс; не включайте его в публичном окружении. Полный ответ может
достигать 129 МБ. Для существующих клиентов миграция — добавить `encoding=compact`
и декодировать nodePool либо явно включить full только в диагностическом процессе.

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

## ArrayList

Без `collection` создание по-прежнему означает HASH_MAP. Для ArrayList:

```json
{"collection":"ARRAY_LIST"}
```

Отсутствие/null `initialCapacity` выбирает default constructor: size=capacity=0,
первая add выделяет 10 ячеек. Явное `"initialCapacity":0` выбирает explicit-empty:
первая add выделяет одну ячейку. Положительное 1..256 выделяет массив сразу.
`GET /scenarios?collection=ARRAY_LIST` возвращает девять сценариев; без query
по-прежнему восемь HashMap-сценариев. Неизвестная коллекция возвращает 400.

Пример `POST /sessions/{id}/commands?encoding=compact`:

```json
{"expectedRevision":0,"operation":{"type":"ADD","element":{"type":"STRING","value":"A"}}}
```

| type | Обязательные поля | Возвращаемый result.kind |
|---|---|---|
| ADD | element | BOOLEAN (true) |
| ADD_AT | index, element | VOID |
| GET_AT | index | ELEMENT |
| SET_AT | index, element | ELEMENT (старое значение) |
| REMOVE_AT | index | ELEMENT (удалённое значение) |
| INDEX_OF | element | INT (первый индекс или -1) |
| ENSURE_CAPACITY | minCapacity | VOID |
| TRIM_TO_SIZE | — | VOID |
| CLEAR | — | VOID |
| RESET | — | RESET (учебная операция) |

`element = {type: STRING|INTEGER|NULL, value: string|null}`. INTEGER хранится в
JSON как строка Java int, нормализованная сервером; STRING остаётся строкой.
Настоящий null передаётся как `{"type":"NULL"}`; отсутствующий element не заменяет
его для команд, требующих значение. Максимум 128 UTF-16 code units, пустая строка
и Unicode разрешены. `index` / `minCapacity` — JSON int32; дроби отклоняются.
ADD_AT принимает 0..size, GET_AT/SET_AT/REMOVE_AT — 0..size-1. Отрицательный
minCapacity — no-op согласно JDK. Удаление реализовано только по индексу.

ArrayList result сохраняет старые nullable поля оболочки, но результат определяется
`kind`: `element` для ELEMENT (в том числе типизированный NULL), `booleanValue`
для BOOLEAN, `intValue` для INT. VOID и RESET не имеют возвращаемого Java-элемента.
HashMap сохраняет семантику found/previousValue/value; новые поля там равны null.
Операция другой коллекции, недопустимый индекс, 129-й элемент или вычисленная
ёмкость >256 дают 400 до мутации, без изменения revision. Лимит ёмкости — ограничение
демонстрации, не Java. Например, ensureCapacity(201) при capacity=200 отклоняется:
OpenJDK выбрал бы 300; движок не округляет её до удобных 256.

Полный ArraySnapshot: `collection`, `phase`, `size`, `capacity`, `emptyMode`,
`initialCapacity` (конфигурация RESET сессии), `buffer`, nullable `pendingBuffer`.
Buffer: `{id, capacity, cells}`. Длина cells равна capacity; каждый слот — либо
JSON null (нет удерживаемого вхождения), либо `{id,element}`. Таким образом
`{id:1,element:{type:"NULL",value:null}}` отличается от свободного слота `null`.
Логическая занятость дополнительно задаётся `index < size`. WORKING может временно
содержать дубликаты или ещё не включённые в size записи. COMMITTED содержит ровно
size занятых записей и пустой хвост. Буфер с capacity=0 имеет id=0 и пустой cells;
его маркер DEFAULT_EMPTY или EXPLICIT_EMPTY задаёт поведение первой аллокации.

`encoding=compact` возвращает `encoding:"array-frames-v1"`, `cellPool` и `bufferPool`.
Каждый bufferPool entry: `{id,capacity,cellRefs}`. cellRefs — абсолютные индексы
cellPool или null для свободных ячеек. В кадрах вместо buffer/pendingBuffer находятся
`bufferRef` / nullable `pendingBufferRef`, абсолютные индексы bufferPool. Это номера
версий в данном ответе, не стабильные ID. Все остальные поля, события и результаты
сохраняются. HashMap продолжает использовать `node-table-v1`.

События: OPERATION_STARTED/COMPLETED, INDEX_CHECKED, CAPACITY_CHECKED,
ARRAY_ALLOCATED, ARRAY_COPY_STARTED/COMPLETED, CAPACITY_GROWN/RESERVED/TRIMMED,
ELEMENTS_SHIFTED_RIGHT/LEFT, ELEMENT_READ/WRITTEN/REPLACED, TAIL_CLEARED,
ELEMENT_COMPARED/FOUND/NOT_FOUND, LIST_CLEARED/RESET. Детали содержат index,
fromIndex/toIndex/length, primitive, oldCapacity/newCapacity/minimumCapacity,
minGrowth/preferredGrowth либо result по смыслу события.

Full остаётся закрытым без `ALLOW_FULL_TRACE=true` для обоих движков и сценариев.
TTL, лимиты нагрузки, optimistic revision, одна фиксация на сценарий и восстановление
потерянных ответов общие. Переключение UI создаёт новую сессию; поздние ответы прошлой
сессии игнорируются. Предыдущие сессии живут до TTL и учитываются в общем лимите.
