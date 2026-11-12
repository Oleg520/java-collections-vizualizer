import { ClientError } from "../i18n/errors";
import { api } from "../api/api";
import type { Scenario, SessionTrace } from "../api/types";
import type { SessionConnection } from "../session/sessionConnection";

/** Loaded only by Vite serve. No extra session, UI, or backend scenario catalog. */
export const localSplits = {
  scenarios: [
    {
      id: "local-split-6-7",
      title: "Локально: split 6/7",
      description: "Только dev: физические копии L3, проблемный кадр 11",
    },
    {
      id: "local-split-2-7",
      title: "Локально: split 2/7",
      description: "Только dev: физические копии L1, проблемный кадр 11",
    },
  ] satisfies Scenario[],
  problemFrame: 11,
  jumpLabel: "К проблемному кадру 11 (шаг 12)",
  async run(
    name: string,
    connection: SessionConnection,
    active: () => boolean,
  ): Promise<SessionTrace> {
    if (!localSplits.scenarios.some((s) => s.id === name))
      throw new ClientError("errors.localUnknown");
    const low = name === "local-split-6-7" ? 6 : 2;
    const check = () => {
      if (!active()) throw new ClientError("errors.localStopped");
    };
    check();
    // The standard treeify demo chooses capacity 64 without changing the session's RESET constructor.
    await connection.execute((s) => api.scenario(s, "treeify"));
    // Pace this dev-only preparation so response/admission cleanup can finish between writes.
    await new Promise((resolve) => setTimeout(resolve, 16));
    check();
    await connection.execute((s) =>
      api.command(s, { type: "CLEAR", key: null, value: null }),
    );
    const keys: [string, number][] = [];
    for (let i = 0; i < low; i++) keys.push([`L${i}`, 1]);
    for (let i = 0; i < 7; i++) keys.push([`H${i}`, 65]);
    for (let i = 0; keys.length < 49; i++) keys.push([`F${i}`, 2 + (i % 30)]);
    let last: SessionTrace | undefined;
    for (const [id, hash] of keys) {
      await new Promise((resolve) => setTimeout(resolve, 16));
      check();
      last = await connection.execute((s) =>
        api.command(s, {
          type: "PUT",
          key: { type: "COLLISION", value: id, hashCodeOverride: hash },
          value: id[0],
        }),
      );
    }
    // Label the local preparation in history; all steps/snapshots remain exactly Java-produced.
    return {
      ...last!,
      trace: {
        ...last!.trace,
        operation: { type: "SCENARIO", key: null, value: name },
      },
    };
  },
};
export type LocalSplits = typeof localSplits;
