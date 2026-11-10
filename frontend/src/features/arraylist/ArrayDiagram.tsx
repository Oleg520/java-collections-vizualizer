import { elementLabel } from "./presentation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ArrayBuffer,
  type ArraySnapshot,
  type Step,
} from "../../api/types/index";

export function ArrayDiagram({
  state,
  step,
}: {
  state: ArraySnapshot;
  step?: Step;
}) {
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<{ buffer: number; index: number }>();
  const selectedBuffer = [state.buffer, state.pendingBuffer].find(
    (b) => b?.id === selected?.buffer,
  );
  const selectedCell = selectedBuffer?.cells[selected?.index ?? -1];
  const d = step?.details ?? {};
  const highlighted = (index: number) =>
    d.index === index ||
    (typeof d.fromIndex === "number" &&
      typeof d.length === "number" &&
      index >= d.fromIndex &&
      index < d.fromIndex + d.length) ||
    (typeof d.toIndex === "number" &&
      typeof d.length === "number" &&
      index >= d.toIndex &&
      index < d.toIndex + d.length);
  const buffer = (b: ArrayBuffer, title: string) => (
    <section className="array-buffer" key={b.id} aria-label={title}>
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
          <AnimatePresence initial={false}>
            {b.cells.map((cell, i) => (
              <motion.button
                layout={!reduced}
                transition={{ duration: reduced ? 0 : 0.25 }}
                key={
                  cell
                    ? `${cell.id}-${b.cells.findIndex((c) => c?.id === cell.id) === i ? "first" : "copy"}`
                    : `empty-${i}`
                }
                initial={reduced ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: reduced ? 1 : 0, scale: reduced ? 1 : 0.85 }}
                className={`array-cell ${cell ? "occupied" : "free"} ${highlighted(i) ? "highlighted" : ""} ${i === state.size ? "size-boundary" : ""}`}
                aria-label={`Ячейка ${i}: ${cell ? elementLabel(cell.element) : "empty"}`}
                aria-pressed={selected?.buffer === b.id && selected.index === i}
                onClick={() => setSelected({ buffer: b.id, index: i })}
              >
                <span className="array-index">
                  [{i}] {i === state.size && <small>size →</small>}
                </span>
                <strong>{cell ? elementLabel(cell.element) : "empty"}</strong>
                <small>
                  {cell ? `${cell.element.type} · #${cell.id}` : "свободно"}
                </small>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
  return (
    <section
      className="panel array-diagram"
      data-testid="array-diagram"
      aria-label="Внутренний массив ArrayList"
      tabIndex={0}
    >
      <div className="array-title">
        <h2>Внутри ArrayList</h2>
        <span className="eyebrow">{state.emptyMode}</span>
      </div>
      <p className="array-legend">
        Заполненная ячейка — логическое вхождение, включая null. Пунктир —
        свободное место.
      </p>
      {buffer(
        state.buffer,
        state.pendingBuffer ? "Старый elementData" : "elementData",
      )}
      {state.pendingBuffer && (
        <>
          <div className="array-copy" role="status">
            ↓ Копирование ссылок ·{" "}
            {step?.event === "ARRAY_COPY_COMPLETED"
              ? "перенос завершён"
              : "подготовка нового массива"}
            <small>
              Объекты не клонируются. Иллюстрация эффекта одной блочной
              операции.
            </small>
          </div>
          {buffer(state.pendingBuffer, "Новый буфер")}
        </>
      )}
      {step && (
        <p className="array-step" aria-live="polite">
          {step.message}
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
    </section>
  );
}
