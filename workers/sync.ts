import { runResultSync } from "../src/server/sync";
import type { Env } from "../src/server/types";

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runResultSync(env));
  },

  async fetch(_request: Request, env: Env) {
    const result = await runResultSync(env);
    return Response.json(result);
  }
};
