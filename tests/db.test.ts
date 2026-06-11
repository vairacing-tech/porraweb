import { describe, expect, it } from "vitest";
import { insertRows } from "../src/server/db";

describe("insertRows", () => {
  it("inserts row by row to avoid D1 variable limits", async () => {
    const calls: unknown[][] = [];
    const sqlStatements: string[] = [];
    const db = {
      prepare(sql: string) {
        sqlStatements.push(sql);
        return {
          bind(...values: unknown[]) {
            calls.push(values);
            return {
              async run() {
                return { success: true };
              }
            };
          }
        };
      }
    } as unknown as D1Database;

    const rows = Array.from({ length: 500 }, (_, index) => [`id-${index}`, `name-${index}`]);
    await insertRows(db, "demo", ["id", "name"], rows);

    expect(calls).toHaveLength(500);
    expect(calls[0]).toEqual(["id-0", "name-0"]);
    expect(sqlStatements.every((sql) => sql === "INSERT OR IGNORE INTO demo (id, name) VALUES (?, ?)")).toBe(true);
  });
});
