const { describe, expect, it } = require("@jest/globals");

describe("js spec discovery", () => {
  it("runs JavaScript specs from src", () => {
    expect(["js", "spec"].join("-")).toBe("js-spec");
  });
});
