import "./HashMapSplitLab.css";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { api } from "../api/api";
import type { Snapshot, Trace } from "../api/types";
import { SessionConnection } from "../session/sessionConnection";
import { Diagram } from "../features/hashmap/Diagram";
import { selectedDetails } from "../features/hashmap/NodeDetails";
import { objectId, type NodeSelection } from "../features/hashmap/identity";
import { useTracePlayback } from "../playback/useTracePlayback";
import { PlaybackPanel } from "../playback/PlaybackPanel";

/** Imported exclusively behind import.meta.env.DEV; no backend scenario/route exists. */
function HashMapSplitLab() {
  const connection = useRef(new SessionConnection());
  const playback = useTracePlayback();
  const [busy, setBusy] = useState(false);
  const [focusSplit, setFocusSplit] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<NodeSelection>();
  const [name, setName] = useState("");
  const [committed, setCommitted] = useState<Snapshot>();
  const state = (playback.step?.snapshot ?? committed) as Snapshot | undefined;
  async function load(low: number) {
    setBusy(true);
    setError("");
    setSelected(undefined);
    playback.pause();
    try {
      await connection.current.change("HASH_MAP", 64, () => true);
      const keys: [string, number][] = [];
      for (let i = 0; i < low; i++) keys.push([`L${i}`, 1]);
      for (let i = 0; i < 7; i++) keys.push([`H${i}`, 65]);
      for (let i = 0; keys.length < 49; i++) keys.push([`F${i}`, 2 + (i % 30)]);
      let last;
      for (const [id, hash] of keys)
        last = await connection.current.execute((s) =>
          api.command(s, {
            type: "PUT",
            key: { type: "COLLISION", value: id, hashCodeOverride: hash },
            value: id[0],
          }),
        );
      const trace = last!.trace as Trace<Snapshot>;
      setSelected(undefined);
      setCommitted(trace.committed);
      setName(`Split ${low}/7`);
      playback.accept(trace);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const display =
    state && focusSplit
      ? {
          ...state,
          buckets: state.buckets.filter((b) => b.index === 1 || b.index === 65),
          pendingBuckets: state.pendingBuckets.filter(
            (b) => b.index === 1 || b.index === 65,
          ),
        }
      : state;
  const details = selectedDetails(state, selected, () =>
    setSelected(undefined),
  );
  const nodes = state
    ? [...state.buckets, ...state.pendingBuckets].flatMap((b) => b.nodes)
    : [];
  const logicalCounts = new Map<number, number>();
  nodes.forEach((n) =>
    logicalCounts.set(n.id, (logicalCounts.get(n.id) ?? 0) + 1),
  );
  const copies = nodes.filter((n) => logicalCounts.get(n.id)! > 1);
  return (
    <main className="app-shell split-lab">
      <h1>HashMap split laboratory · local development only</h1>
      <p>
        Реальные Java-команды. Две копии записи имеют общий id и разные
        objectId. «Вне цепочки» — временный объект, а не дополнительная запись
        Map.
      </p>
      <div className="transport">
        <button disabled={busy} onClick={() => void load(6)}>
          Загрузить split 6/7
        </button>
        <button disabled={busy} onClick={() => void load(2)}>
          Загрузить split 2/7
        </button>
        <button
          disabled={!playback.trace || busy}
          onClick={() => playback.navigate(11)}
        >
          Кадр 11 (шаг 12)
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void connection.current
              .refresh()
              .then((s) => {
                if (s) setCommitted(s.state as Snapshot);
                playback.showCommitted();
                setError("");
              })
              .catch((e) => setError(String(e)))
          }
        >
          Прочитать сервер (GET)
        </button>
      </div>
      <p role="status">
        {busy ? "Подготавливаем 49 записей…" : name} · index={playback.cursor} ·
        size={state?.size ?? 0}
      </p>
      {error && (
        <p role="alert">{error}. Операции автоматически не повторяются.</p>
      )}
      <PlaybackPanel
        playback={playback}
        step={playback.step}
        onSelectHistory={(index) => {
          setSelected(undefined);
          playback.selectHistory(index);
        }}
      />
      {copies.length > 0 && (
        <section
          className="panel"
          aria-label="Одновременные физические представления"
        >
          <h2>Несколько объектов одной записи</h2>
          <p>
            Выберите объект, затем нажмите «К выбранному узлу» на диаграмме.
          </p>
          {copies.map((n) => (
            <button
              key={n.objectId}
              onClick={() =>
                setSelected({ logicalId: n.id, preferredObjectId: n.objectId })
              }
            >
              Запись #{n.id} · obj {n.objectId} ·{" "}
              {n.linked ? "в цепочке" : "вне цепочки"}
            </button>
          ))}
        </section>
      )}
      <label>
        <input
          type="checkbox"
          checked={focusSplit}
          onChange={(e) => setFocusSplit(e.target.checked)}
        />
        Показать только области split 1/65 (size остаётся размером всей Map)
      </label>
      {display && (
        <Diagram
          state={display}
          step={playback.step}
          selectedId={selected}
          onSelect={(n) =>
            setSelected({ logicalId: n.id, preferredObjectId: objectId(n) })
          }
        />
      )}
      {details && (
        <aside className="panel" aria-label="Выбранный физический объект">
          <h2>{details.title}</h2>
          {details.content}
        </aside>
      )}
      {playback.trace && (
        <details>
          <summary>События последней операции (индексы с нуля)</summary>
          {playback.trace.steps.map((s) => (
            <button key={s.index} onClick={() => playback.navigate(s.index)}>
              {s.index}: {s.event}{" "}
            </button>
          ))}
        </details>
      )}
    </main>
  );
}
export function mountSplitLab() {
  createRoot(document.getElementById("root")!).render(
    <MotionConfig reducedMotion="user">
      <HashMapSplitLab />
    </MotionConfig>,
  );
}
