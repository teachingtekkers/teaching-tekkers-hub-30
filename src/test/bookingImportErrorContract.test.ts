import { describe, expect, it } from "vitest";
import { describeBackendError } from "../../supabase/functions/_shared/booking-errors";
import { assertPreviewContract, readableImportError } from "@/lib/importPreviewContract";

const timeout = { code: "57014", details: null, hint: null, message: "canceling statement due to statement timeout" };

describe("backend error description", () => {
  it("turns the real statement-timeout database error into a readable 503, never [object Object]", () => {
    const info = describeBackendError(timeout);
    expect(info.status).toBe(503);
    expect(info.code).toBe("57014");
    expect(info.message).toMatch(/Nothing was saved or imported/);
    expect(info.message).not.toContain("[object Object]");
  });
  it("uses the message of a plain database error object", () => {
    expect(describeBackendError({ code: "P0001", message: "Evidence changed while preparing preview; preview again" }).message).toBe("Evidence changed while preparing preview; preview again");
  });
  it("never returns [object Object] for objects without a message", () => {
    expect(describeBackendError({ foo: 1 }).message).not.toContain("[object Object]");
    expect(describeBackendError({}).status).toBe(500);
  });
});

describe("client preview contract (fail closed)", () => {
  const ok = { run_id: "6c326dcf-0000-4000-8000-000000000001", camp_name: "Synthetic", counts: { participants: 24, new: 17, ambiguous: 7 }, rows: [], candidates: [], warnings: [] };
  it("accepts a complete successful preview", () => {
    expect(assertPreviewContract<typeof ok>(ok).run_id).toBe(ok.run_id);
  });
  it("rejects a structured backend error body", () => {
    expect(() => assertPreviewContract({ error: "The safety check took too long", code: "57014" })).toThrow(/took too long/);
  });
  it("rejects incomplete previews (no run id or counts)", () => {
    expect(() => assertPreviewContract({ ...ok, run_id: undefined })).toThrow(/incomplete/);
    expect(() => assertPreviewContract({ ...ok, counts: undefined })).toThrow(/incomplete/);
    expect(() => assertPreviewContract(null)).toThrow(/empty/);
  });
  it("extracts readable text from nested error objects and rejects literal [object Object]", () => {
    expect(readableImportError({ error: { message: "Admins only" } }, "fallback")).toBe("Admins only");
    expect(readableImportError({ error: "[object Object]" }, "fallback")).toBe("fallback");
    expect(readableImportError(timeout, "fallback")).toBe(timeout.message);
  });
});
