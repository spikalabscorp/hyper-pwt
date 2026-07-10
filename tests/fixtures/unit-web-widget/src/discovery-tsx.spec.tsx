declare const describe: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => { toBe: (expected: unknown) => void };
declare const it: (name: string, fn: () => void) => void;

export {};

type Probe = {
  label: "tsx";
};

describe("tsx spec discovery", () => {
  it("runs TSX specs through the SWC transform", () => {
    const probe: Probe = { label: "tsx" };

    expect(`${probe.label}-spec`).toBe("tsx-spec");
  });
});
