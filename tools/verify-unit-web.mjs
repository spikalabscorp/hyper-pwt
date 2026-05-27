import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixtureSource = path.join(repoRoot, "tests/fixtures/unit-web-widget");
const cliPath = path.join(repoRoot, "dist/cli.cjs");
const binNames = ["hyper-pwt", "pluggable-widgets-tools"];

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "hyper-pwt-unit-web-"),
);

try {
  await assertFileExists(
    cliPath,
    "Build output dist/cli.cjs is required before running this verifier.",
  );

  const fixture = await createFixture("passing");

  const showConfig = await runBin(fixture, "hyper-pwt", [
    "test:unit:web",
    "--showConfig",
    "--runInBand",
    "--coverage=false",
    "--ci",
    "--no-cache",
    "--subprojectPath",
    "ignored",
  ]);
  assertForwardedConfig(showConfig.output);

  const passing = await runBin(fixture, "hyper-pwt", [
    "test:unit:web",
    "--runInBand",
    "--coverage=false",
    "--no-cache",
    "--subprojectPath",
    "ignored",
  ]);
  assertIncludesAll(
    passing.output,
    [
      "discovery-js.spec.js",
      "discovery-jsx.spec.jsx",
      "discovery-ts.spec.ts",
      "discovery-tsx.spec.tsx",
      "compatibility.spec.js",
    ],
    "Expected all JS/JSX/TS/TSX and compatibility specs to run.",
  );
  await assertPathMissing(
    path.join(fixture, "dist/coverage"),
    "--coverage=false should disable coverage output.",
  );

  await runBin(fixture, "hyper-pwt", [
    "test:unit",
    "--runInBand",
    "--coverage=false",
    "--no-cache",
  ]);
  await runBin(fixture, "pluggable-widgets-tools", [
    "test:unit:web",
    "--runInBand",
    "--coverage=false",
    "--no-cache",
  ]);

  await fs.rm(path.join(fixture, "dist"), { force: true, recursive: true });
  await runBin(
    fixture,
    "hyper-pwt",
    ["test:unit:web", "--runInBand", "--coverage", "--no-cache"],
    {
      CI: "true",
    },
  );
  await assertFileExists(
    path.join(fixture, "dist/coverage/coverage-final.json"),
    "--coverage should write coverage output to dist/coverage.",
  );

  const snapshotFixture = await createFixture("snapshot");
  await fs.writeFile(
    path.join(snapshotFixture, "src/snapshot.spec.js"),
    [
      'const { expect, it } = require("@jest/globals");',
      "",
      'it("updates snapshots through forwarded Jest args", () => {',
      '    expect({ value: "snapshotted" }).toMatchSnapshot();',
      "});",
      "",
    ].join("\n"),
  );
  const ciSnapshot = await runBin(
    snapshotFixture,
    "hyper-pwt",
    ["test:unit:web", "--runInBand", "--coverage=false", "--ci", "--no-cache"],
    {},
    { allowFailure: true },
  );
  assertNonZero(
    ciSnapshot,
    "--ci should be forwarded and reject new snapshots.",
  );

  await runBin(snapshotFixture, "hyper-pwt", [
    "test:unit:web",
    "--runInBand",
    "--coverage=false",
    "--u",
    "--no-cache",
  ]);
  await assertFileExists(
    path.join(snapshotFixture, "src/__snapshots__/snapshot.spec.js.snap"),
    "--u should update Jest snapshots.",
  );

  const failingFixture = await createFixture("failing");
  await fs.writeFile(
    path.join(failingFixture, "src/failing.spec.js"),
    [
      'const { expect, it } = require("@jest/globals");',
      "",
      'it("fails deliberately", () => {',
      "    expect(1).toBe(2);",
      "});",
      "",
    ].join("\n"),
  );
  const failing = await runBin(
    failingFixture,
    "hyper-pwt",
    ["test:unit:web", "--runInBand", "--coverage=false", "--no-cache"],
    {},
    { allowFailure: true },
  );
  assertNonZero(
    failing,
    "Failing Jest specs should propagate a nonzero exit code.",
  );

  const unknown = await runBin(
    fixture,
    "hyper-pwt",
    ["unknown:command"],
    {},
    { allowFailure: true },
  );
  assertNonZero(unknown, "Unknown commands should keep exiting nonzero.");
  assertIncludesAll(
    unknown.output,
    ["Unknown command passed to hyper-pwt script: 'unknown:command'"],
    "Unknown command output changed.",
  );

  console.log("unit web verifier passed");
} finally {
  if (!process.env.KEEP_HYPER_PWT_TEST_TMP) {
    await fs.rm(tempRoot, { force: true, recursive: true });
  }
}

async function createFixture(name) {
  const destination = path.join(tempRoot, name);

  await fs.cp(fixtureSource, destination, { recursive: true });
  await fs.mkdir(path.join(destination, "node_modules/.bin"), {
    recursive: true,
  });

  for (const binName of binNames) {
    const wrapperPath = path.join(destination, "node_modules/.bin", binName);
    await fs.writeFile(wrapperPath, buildBinWrapper());
    await fs.chmod(wrapperPath, 0o755);
  }

  return destination;
}

function buildBinWrapper() {
  return [
    "#!/usr/bin/env sh",
    `exec '${escapeSingleQuotes(process.execPath)}' '${escapeSingleQuotes(cliPath)}' "$@"`,
    "",
  ].join("\n");
}

function escapeSingleQuotes(value) {
  return value.replaceAll("'", "'\\''");
}

async function runBin(cwd, binName, args, env = {}, options = {}) {
  const binDirectory = path.join(cwd, "node_modules/.bin");

  return run(binName, args, {
    allowFailure: options.allowFailure,
    cwd,
    env: {
      ...env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
    },
  });
}

async function run(command, args, options) {
  const output = [];

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => output.push(data.toString()));
    child.stderr.on("data", (data) => output.push(data.toString()));
    child.on("error", reject);
    child.on("exit", (code) => {
      const result = {
        code: code ?? 1,
        output: output.join(""),
      };

      if (result.code !== 0 && !options.allowFailure) {
        reject(
          new Error(
            `Command failed (${result.code}): ${command} ${args.join(" ")}\n${result.output}`,
          ),
        );
        return;
      }

      resolve(result);
    });
  });
}

function assertForwardedConfig(output) {
  const config = parseJestShowConfig(output);
  const globalConfig = config.globalConfig;

  assert(
    globalConfig.maxWorkers === 1,
    "--runInBand was not forwarded to Jest.",
  );
  assert(
    config.configs.every((projectConfig) => projectConfig.cache === false),
    "--no-cache was not forwarded to Jest.",
  );
  assert(globalConfig.ci === true, "--ci was not forwarded to Jest.");
  assert(
    globalConfig.collectCoverage === false,
    "--coverage=false was not forwarded to Jest.",
  );
}

function parseJestShowConfig(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  assert(
    start >= 0 && end > start,
    `Unable to parse Jest --showConfig output:\n${output}`,
  );

  return JSON.parse(output.slice(start, end + 1));
}

function assertIncludesAll(output, expectedValues, message) {
  for (const expected of expectedValues) {
    assert(
      output.includes(expected),
      `${message}\nMissing: ${expected}\nOutput:\n${output}`,
    );
  }
}

function assertNonZero(result, message) {
  assert(
    result.code !== 0,
    `${message}\nCommand unexpectedly exited with 0.\nOutput:\n${result.output}`,
  );
}

async function assertFileExists(filePath, message) {
  try {
    const stats = await fs.stat(filePath);

    assert(
      stats.isFile(),
      `${message}\nPath exists but is not a file: ${filePath}`,
    );
  } catch {
    throw new Error(`${message}\nMissing file: ${filePath}`);
  }
}

async function assertPathMissing(filePath, message) {
  try {
    await fs.stat(filePath);
  } catch {
    return;
  }

  throw new Error(`${message}\nUnexpected path exists: ${filePath}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
