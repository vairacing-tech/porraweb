import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBootstrap } from "../src/client/api";

describe("fetchBootstrap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a legacy bootstrap response without achievementLeaderboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ appName: "Porra Fortilin" }), {
          headers: { "content-type": "application/json" }
        })
      )
    );

    await expect(fetchBootstrap()).resolves.toMatchObject({ achievementLeaderboard: [] });
  });
});
