declare const describe: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => { toBe: (expected: unknown) => void };
declare const it: (name: string, fn: () => void) => void;

export {};

describe("ts spec discovery", () => {
  it("runs TypeScript specs from src", () => {
    const value: string = ["ts", "spec"].join("-");

    expect(value).toBe("ts-spec");
  });
});
