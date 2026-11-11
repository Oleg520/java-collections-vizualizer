import { eventExplanation } from "../../i18n/events";
import { useI18n } from "../../i18n/LocaleProvider";
import { elementLabel } from "./presentation";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import {
  type ArrayBuffer,
  type ArraySnapshot,
  type Step,
} from "../../api/types/index";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (notify: () => void) => {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const prefersReducedMotion = () =>
  window.matchMedia(reducedMotionQuery).matches;
const inRange = (index: number, start: unknown, length: unknown) =>
  typeof start === "number" &&
  typeof length === "number" &&
  index >= start &&
  index < start + length;
const rangeLabel = (start: number, length: number) =>
  length === 0 ? "∅" : `[${start}…${start + length - 1}]`;

export function ArrayDiagram({
  state,
  step,
  playing = false,
}: {
  state: ArraySnapshot;
  step?: Step;
  playing?: boolean;
}) {
  const { locale } = useI18n();
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  );
  const panel = useRef<HTMLElement>(null);
  const previousPendingId = useRef<number | undefined>(undefined);
  const scrollAnchor = useRef<{ id: string; offset: number } | undefined>(
    undefined,
  );
  const [selected, setSelected] = useState<{ buffer: number; index: number }>();
  const buffers = [
    state.buffer,
    ...(state.pendingBuffer ? [state.pendingBuffer] : []),
  ];
  const selectedBuffer = buffers.find((b) => b.id === selected?.buffer);
  const selectedCell = selectedBuffer?.cells[selected?.index ?? -1];
  const d = step?.details ?? {};
  const shifting =
    step?.event === "ELEMENTS_SHIFTED_RIGHT" ||
    step?.event === "ELEMENTS_SHIFTED_LEFT";
  const copying = !!state.pendingBuffer;
  const copyLength = typeof d.length === "number" ? d.length : 0;
  const copyRange = rangeLabel(0, copyLength);
  const unallocated = state.buffer.capacity === 0 && !copying;

  // Keep the viewed buffer in place when the old array is removed above it.
  const rememberScroll = () => {
    const el = panel.current;
    if (!el) return;
    const sections = [...el.querySelectorAll<HTMLElement>("[data-buffer-id]")];
    const anchor =
      sections.filter((b) => b.offsetTop <= el.scrollTop + 120).at(-1) ??
      sections[0];
    scrollAnchor.current = anchor
      ? {
          id: anchor.dataset.bufferId!,
          offset: anchor.offsetTop - el.scrollTop,
        }
      : undefined;
  };
  useLayoutEffect(() => {
    const el = panel.current;
    const anchor = scrollAnchor.current;
    const section =
      anchor &&
      el?.querySelector<HTMLElement>(`[data-buffer-id="${anchor.id}"]`);
    if (
      el &&
      section &&
      previousPendingId.current === state.buffer.id &&
      anchor.id === String(state.buffer.id)
    )
      el.scrollTop = section.offsetTop - anchor.offset;
    previousPendingId.current = state.pendingBuffer?.id;
    rememberScroll();
  }, [state]);

  const buffer = (b: ArrayBuffer) => {
    const pending = b.id === state.pendingBuffer?.id;
    const title = pending
      ? "Новый буфер"
      : copying
        ? "Старый elementData"
        : "elementData";
    return (
      <motion.section
        className="array-buffer"
        key={b.id}
        data-buffer-id={b.id}
        aria-label={title}
        layout={playing && !reduced ? "position" : false}
        transition={{ duration: 0.12, ease: "easeOut" }}
      >
        <div className="array-buffer-heading">
          <strong>
            {title} <code>#{b.id}</code>
          </strong>
          <span>Object[{b.capacity}]</span>
        </div>
        {b.capacity === 0 ? (
          <div className="array-empty">
            <strong>Массив ещё не выделен</strong>
            <p>
              {state.emptyMode === "DEFAULT_EMPTY"
                ? "Default-empty: первая add выделит 10 ячеек. Сейчас capacity = 0."
                : "Explicit-empty: первая add выделит 1 ячейку."}
            </p>
          </div>
        ) : (
          <div className="array-cells">
            {b.cells.map((cell, i) => {
              const source = shifting
                ? inRange(i, d.fromIndex, d.length)
                : copying && !pending && inRange(i, 0, d.length);
              const target = shifting
                ? inRange(i, d.toIndex, d.length)
                : copying && pending && inRange(i, 0, d.length);
              const label = cell ? elementLabel(cell.element) : "empty";
              const metadata = cell
                ? `${cell.element.type} · #${cell.id}`
                : "свободно";
              return (
                <button
                  key={`${b.id}:${i}`}
                  data-slot-index={i}
                  className={`array-cell ${cell ? "occupied" : "free"} ${d.index === i || source || target ? "highlighted" : ""} ${source ? "range-source" : ""} ${target ? "range-target" : ""} ${i === state.size ? "size-boundary" : ""}`}
                  aria-label={`Ячейка ${i}: ${label}`}
                  aria-description={`${metadata}; буфер #${b.id}${source ? "; источник диапазона" : ""}${target ? "; приёмник диапазона" : ""}`}
                  aria-pressed={
                    selected?.buffer === b.id && selected.index === i
                  }
                  title={`${label} · ${metadata}`}
                  onClick={() => setSelected({ buffer: b.id, index: i })}
                >
                  <span className="array-index">
                    <span>[{i}]</span>
                    <small>{i === state.size ? "size →" : ""}</small>
                  </span>
                  <span
                    className="array-cell-content"
                    key={cell?.id ?? "empty"}
                  >
                    <strong>{label}</strong>
                    <small>
                      {cell ? (
                        <>
                          <span className="array-element-type">
                            {cell.element.type}
                          </span>
                          <span className="array-occurrence">#{cell.id}</span>
                        </>
                      ) : (
                        metadata
                      )}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </motion.section>
    );
  };
  return (
    <motion.section
      layoutScroll
      ref={panel}
      className="panel array-diagram"
      data-testid="array-diagram"
      aria-label="Внутренний массив ArrayList"
      tabIndex={0}
      onScroll={rememberScroll}
    >
      <div className="array-title">
        <h2>Внутри ArrayList</h2>
        <span className="eyebrow">{state.emptyMode}</span>
      </div>
      <p className="array-legend">
        Ячейка — фиксированный индекс массива. Внутри — ссылка, включая null;
        пунктир — свободное место.
      </p>
      {!unallocated && (
        <div className="array-operation" role="status" aria-live="polite">
          {copying ? (
            <>
              <strong>
                Копирование ссылок ·{" "}
                {step?.event === "ARRAY_COPY_COMPLETED"
                  ? "завершено"
                  : "подготовка"}
              </strong>
              <div className="array-transfer">
                <span className="array-source">
                  #{state.buffer.id}{" "}
                  {typeof d.length === "number"
                    ? copyRange
                    : `Object[${state.buffer.capacity}]`}
                </span>
                <span aria-label="в">→</span>
                <span className="array-target">
                  #{state.pendingBuffer!.id}{" "}
                  {typeof d.length === "number"
                    ? copyRange
                    : `Object[${state.pendingBuffer!.capacity}]`}
                </span>
              </div>
              <small>
                {step?.event === "ARRAY_ALLOCATED"
                  ? "Новый массив выделен; ссылки ещё не перенесены."
                  : "Одна блочная операция. Объекты не клонируются."}
              </small>
            </>
          ) : shifting ? (
            <>
              <strong>
                Сдвиг{" "}
                {step?.event === "ELEMENTS_SHIFTED_RIGHT" ? "вправо" : "влево"}{" "}
                · System.arraycopy
              </strong>
              <div className="array-transfer">
                <span className="array-source">
                  {rangeLabel(Number(d.fromIndex), Number(d.length))}
                </span>
                <span aria-label="в">→</span>
                <span className="array-target">
                  {rangeLabel(Number(d.toIndex), Number(d.length))}
                </span>
              </div>
              <small>Источник → приёмник · одна блочная операция</small>
            </>
          ) : (
            <>
              <strong>elementData → #{state.buffer.id}</strong>
              <span>
                size {state.size} · capacity {state.capacity}
              </span>
              <small>Индексы остаются на месте при изменении ссылок.</small>
            </>
          )}
        </div>
      )}
      <div className="array-buffers">{buffers.map(buffer)}</div>
      {step && (
        <p className="array-step" aria-live="polite">
          {eventExplanation(locale, step)}
        </p>
      )}
      {selected && selectedBuffer && (
        <div className="array-selection" aria-label="Сведения о ячейке">
          <strong>
            Буфер #{selected.buffer} · индекс {selected.index}
          </strong>
          <p>
            {selectedCell
              ? `${elementLabel(selectedCell.element)} · ${selectedCell.element.type} · вхождение #${selectedCell.id}`
              : "empty · нет удерживаемой ссылки"}
          </p>
          <small>
            {selected.index < state.size
              ? "Индекс входит в логический размер списка"
              : "Индекс за границей size"}{" "}
            · {state.phase}
          </small>
        </div>
      )}
    </motion.section>
  );
}
