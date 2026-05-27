import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_DIRECTORY } from "../../../../constants";

const requireFromCli = createRequire(import.meta.url);
const PACKAGE_NAME = "@shiianamchi/hyper-pwt";

async function testUnitWebCommand(args: string[] = []): Promise<void> {
  const packageRoot = findPackageRoot();
  const jestBin = resolveJestBin();
  const jestConfig = path.join(packageRoot, "test-config/jest.config.js");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [jestBin, "--projects", jestConfig, ...args],
      {
        cwd: PROJECT_DIRECTORY,
        env: process.env,
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`jest was interrupted by signal ${signal}.`));
        return;
      }

      if (code && code !== 0) {
        process.exitCode = code;
        reject(new Error(`jest exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

function resolveJestBin(): string {
  const packageJsonPath = requireFromCli.resolve("jest/package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const binPath =
    typeof packageJson.bin === "string"
      ? packageJson.bin
      : packageJson.bin.jest;

  return path.join(path.dirname(packageJsonPath), binPath);
}

function findPackageRoot(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const packageJsonPath = path.join(directory, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      if (packageJson.name === PACKAGE_NAME) {
        return directory;
      }
    }

    const parent = path.dirname(directory);

    if (parent === directory) {
      throw new Error(`Unable to locate ${PACKAGE_NAME} package root.`);
    }

    directory = parent;
  }
}

export default testUnitWebCommand;
