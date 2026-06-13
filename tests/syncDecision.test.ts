import { describe, expect, it } from "vitest";
import { getResultSyncDecision } from "../src/server/sync";
import type { Env } from "../src/server/types";

function envForDecision(input: { activeMatchId?: string | null; lastFullSyncAt?: string | null }): Env {
  return {
    DB: {
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("FROM matches")) {
                  return input.activeMatchId ? { id: input.activeMatchId } : null;
                }
                return null;
              }
            };
          },
          async first() {
            if (sql.includes("FROM sync_runs")) {
              return input.lastFullSyncAt ? { finished_at: input.lastFullSyncAt } : null;
            }
            return null;
          }
        };
      }
    }
  } as unknown as Env;
}

describe("result sync cadence decision", () => {
  it("runs live sync when a match is in the active window", async () => {
    const decision = await getResultSyncDecision(
      envForDecision({ activeMatchId: "match-live", lastFullSyncAt: "2026-06-13T19:30:00.000Z" }),
      new Date("2026-06-13T20:00:00.000Z")
    );

    expect(decision).toMatchObject({
      shouldRun: true,
      cadence: "live",
      includeAuxiliaryData: false,
      provider: "openligadb-live"
    });
  });

  it("runs a full hourly sync during an active match when the last full sync is stale", async () => {
    const decision = await getResultSyncDecision(
      envForDecision({ activeMatchId: "match-live", lastFullSyncAt: "2026-06-13T18:59:59.000Z" }),
      new Date("2026-06-13T20:00:00.000Z")
    );

    expect(decision).toMatchObject({
      shouldRun: true,
      cadence: "hourly",
      includeAuxiliaryData: true,
      provider: "openligadb"
    });
  });

  it("skips when there is no active match and the last full sync is recent", async () => {
    const decision = await getResultSyncDecision(
      envForDecision({ lastFullSyncAt: "2026-06-13T19:30:00.000Z" }),
      new Date("2026-06-13T20:00:00.000Z")
    );

    expect(decision).toMatchObject({
      shouldRun: false,
      cadence: "recent"
    });
  });

  it("runs a full hourly sync when there is no active match and the last full sync is stale", async () => {
    const decision = await getResultSyncDecision(
      envForDecision({ lastFullSyncAt: "2026-06-13T18:59:59.000Z" }),
      new Date("2026-06-13T20:00:00.000Z")
    );

    expect(decision).toMatchObject({
      shouldRun: true,
      cadence: "hourly",
      includeAuxiliaryData: true,
      provider: "openligadb"
    });
  });
});
