import { describe, it, expect } from "vitest";
import { isAbortError } from "@/lib/error-capture";

describe("isAbortError", () => {
  it("identifies AbortError instances", () => {
    const error = new Error("This operation was aborted");
    error.name = "AbortError";
    expect(isAbortError(error)).toBe(true);
  });

  it("identifies error with message aborted (Node HTTP abortIncoming)", () => {
    const error = new Error("aborted");
    expect(isAbortError(error)).toBe(true);
  });

  it("identifies wrapped errors with an abort cause", () => {
    const root = new Error("aborted");
    const wrapped = new Error("HTTPError", { cause: root });
    expect(isAbortError(wrapped)).toBe(true);
  });

  it("identifies ECONNRESET and premature close codes", () => {
    const error = Object.assign(new Error("Connection lost"), { code: "ECONNRESET" });
    expect(isAbortError(error)).toBe(true);

    const premature = Object.assign(new Error("Premature close"), { code: "ERR_STREAM_PREMATURE_CLOSE" });
    expect(isAbortError(premature)).toBe(true);
  });

  it("returns false for regular errors", () => {
    expect(isAbortError(new Error("Database connection failed"))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});
