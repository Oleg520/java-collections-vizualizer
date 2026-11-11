/** UI text only. Java identifiers and user values never pass through this catalog. */
export const ru = {
  language: "Язык интерфейса",
  pause: "Пауза",
  play: "Воспроизвести",
  events: "События",
  algorithm: "Алгоритм",
  executionTrace: "ТРАССИРОВКА ВЫПОЛНЕНИЯ",
  playing: "ВОСПРОИЗВЕДЕНИЕ",
  paused: "ПАУЗА",
  connected: "Java-движок подключён",
  title: "Java Collections Visualizer — лаборатория коллекций",
  description:
    "Интерактивная лаборатория Java HashMap и ArrayList: коллизии, деревья, рост массива и перемещение ссылок шаг за шагом.",
} as const;
export type MessageKey = keyof typeof ru;
export type Catalog = { [K in MessageKey]: string };
export const en: Catalog = {
  language: "Interface language",
  pause: "Pause",
  play: "Play",
  events: "Events",
  algorithm: "Algorithm",
  executionTrace: "EXECUTION TRACE",
  playing: "PLAYING",
  paused: "PAUSED",
  connected: "Java engine connected",
  title: "Java Collections Visualizer — Collections Lab",
  description:
    "An interactive Java HashMap and ArrayList lab: collisions, trees, array growth and reference movement, step by step.",
};
