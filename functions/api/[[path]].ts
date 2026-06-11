import { handleApi } from "../../src/server/api";
import type { Env } from "../../src/server/types";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  return handleApi(request, env);
};
