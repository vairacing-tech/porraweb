import { handleApi } from "../src/server/api";
import type { Env } from "../src/server/types";

type AppEnv = Env & {
  ASSETS: Fetcher;
};

export default {
  async fetch(request: Request, env: AppEnv) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
