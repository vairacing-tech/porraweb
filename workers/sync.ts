import { runResultSync } from "../src/server/sync";
import type { Env } from "../src/server/types";

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runResultSync(env, { mode: "adaptive" }));
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "adaptive" ? "adaptive" : "force";
    const result = await runResultSync(env, { mode });
    return Response.json(result);
  }
};
