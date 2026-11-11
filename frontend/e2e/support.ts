import { test as base, expect, type Page } from "@playwright/test";
export { expect } from "@playwright/test";
export type { Page, Locator } from "@playwright/test";

const sessions = new WeakMap<Page, { id: string; revision: number }>();

/** Observe the same replies available to the UI, including recovery after lost writes. */
export const test = base.extend<{ observeSessions: void }>({
  observeSessions: [
    async ({ context }, use) => {
      const attach = (page: Page) => {
        page.on("response", async (response) => {
          if (
            !response.ok() ||
            !/\/api\/v1\/sessions(?:\/|\?)/.test(response.url())
          )
            return;
          try {
            const body = await response.json();
            const id = body.sessionId ?? body.id;
            if (typeof id !== "string" || typeof body.revision !== "number")
              return;
            const previous = sessions.get(page);
            sessions.set(page, {
              id,
              revision:
                previous?.id === id
                  ? Math.max(previous.revision, body.revision)
                  : body.revision,
            });
          } catch {
            /* An interrupted response is not a confirmed session read. */
          }
        });
      };
      context.on("page", attach);
      await use();
      context.off("page", attach);
    },
    { auto: true },
  ],
});

/** The server row was removed; assert real committed Java state and an observed revision. */
export async function expectServerSize(page: Page, size: number) {
  // Do not compete with a pending mutation for the per-client admission slot.
  await expect(page.locator(".connection")).not.toContainText("Java выполняет");
  await expect
    .poll(
      async () => {
        const session = sessions.get(page);
        if (!session) return undefined;
        const response = await page.request.get(
          `/api/v1/sessions/${session.id}?snapshotVersion=2`,
        );
        if (response.status() === 429) return undefined;
        expect(response.ok()).toBe(true);
        const current = await response.json();
        if (current.revision !== sessions.get(page)?.revision) return undefined;
        return current.state.size;
      },
      {
        message: `Java committed size ${size}, with revision observed by the UI`,
      },
    )
    .toBe(size);
}
