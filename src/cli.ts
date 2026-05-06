#!/usr/bin/env node

import { program } from "commander";

import packageJson from "../package.json";
import buildWebCommand from "./commands/build/web";
import lintingCommand from "./commands/linting";
import startWebCommand from "./commands/start/web";
import { COLOR_ERROR } from "./constants";
import showMessage from "./utils/showMessage";

program.version(
  packageJson.version,
  "-v, --version",
  "display current version",
);

program
  .command("build:web")
  .summary("build web widget")
  .option("-p, --production", "build web widget with production optimizations")
  .action(async (options: { production?: boolean }) => {
    await buildWebCommand(Boolean(options.production));
  });

program
  .command("release:web")
  .summary("release web widget")
  .action(async () => {
    await buildWebCommand(true);
  });

program
  .command("start:web")
  .summary("start web widget live reload")
  .action(startWebCommand);

program
  .command("lint")
  .summary("lint widget source with oxlint")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async function () {
    await runCliAction(async () => {
      await lintingCommand("lint", this.args);
    });
  });

program
  .command("lint:fix")
  .summary("fix lint and format issues with oxlint and oxfmt")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async function () {
    await runCliAction(async () => {
      await lintingCommand("lint:fix", this.args);
    });
  });

program
  .command("format")
  .summary("format widget source with oxfmt")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async function () {
    await runCliAction(async () => {
      await lintingCommand("format", this.args);
    });
  });

program.parse();

async function runCliAction(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
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
}
