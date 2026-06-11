export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "JSON invalido.");
  }
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `El campo ${field} es obligatorio.`);
  }
  return value.trim();
}

export function requireInt(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new HttpError(400, `El campo ${field} debe ser un entero.`);
  }
  return parsed;
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return json({ error: "Error interno." }, { status: 500 });
}
