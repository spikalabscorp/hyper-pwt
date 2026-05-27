const { describe, expect, it } = require("@jest/globals");

class JsxSpecProbe {
  label = "jsx";

  #suffix() {
    return "spec";
  }

  value() {
    return `${this.label}-${this.#suffix()}`;
  }
}

describe("jsx spec discovery", () => {
  it("runs JSX specs through the Babel transform", () => {
    expect(new JsxSpecProbe().value()).toBe("jsx-spec");
  });
});
