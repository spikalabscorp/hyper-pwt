#!/usr/bin/env node

import buildWebCommand from "./commands/build/web";
import lintingCommand from "./commands/linting";
import startWebCommand from "./commands/start/web";
import testUnitWebCommand from "./commands/test/unit/web";
import { COLOR_ERROR } from "./constants";
import showMessage from "./utils/showMessage";

type LintingCommand = "lint" | "lint:fix" | "format";

const [, , command, ...args] = process.argv;
const normalizedArgs = removeSubprojectPath(args);

runCommand(command, normalizedArgs).catch((error) => {
  handleCliError(error);
});

async function runCommand(cmd: string | undefined, args: string[]) {
  switch (cmd) {
    case "start:web":
    case "start:server":
    case "dev:js":
    case "dev:ts":
      showRunMessage(cmd);
      await runCliAction(startWebCommand);
      return;

    case "start:js":
    case "start:ts":
      showRunMessage(cmd);
      console.log(
        "This command has no effect, use hyper-pwt start:web instead!",
      );
      return;

    case "build:web":
    case "build:js":
    case "build:ts":
      showRunMessage(cmd);
      await runCliAction(async () => {
        await buildWebCommand(false);
      });
      return;

    case "release:web":
    case "release:js":
    case "release:ts":
      showRunMessage(cmd);
      await runCliAction(async () => {
        await buildWebCommand(true);
      });
      return;

    case "lint":
    case "lint:fix":
    case "format":
      showRunMessage(cmd);
      await runCliAction(async () => {
        await lintingCommand(cmd as LintingCommand, args);
      });
      return;

    case "test:unit":
    case "test:unit:web":
      showRunMessage(cmd);
      await runCliAction(async () => {
        await testUnitWebCommand(args);
      });
      return;

    default:
      console.error(`Unknown command passed to hyper-pwt script: '${cmd}'`);
      process.exit(1);
  }
}

function removeSubprojectPath(args: string[]) {
  const result = [...args];
  const subprojectPathIndex = result.indexOf("--subprojectPath");

  if (subprojectPathIndex > -1) {
    result.splice(subprojectPathIndex, 2);
  }

  return result;
}

function showRunMessage(cmd: string) {
  console.log(`Running hyper-pwt script ${cmd}...`);
}

async function runCliAction(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    handleCliError(error);
  }
}

function handleCliError(error: unknown): never {
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  showMessage(
    `${COLOR_ERROR("Command failed.")}\nError occurred: ${COLOR_ERROR(
      (error as Error).stack,
    )}`,
  );
  process.exit(1);
}
