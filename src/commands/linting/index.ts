import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { PROJECT_DIRECTORY } from "../../constants";
import pathIsExists from "../../utils/pathIsExists";
import showMessage from "../../utils/showMessage";

const requireFromCli = createRequire(import.meta.url);

const FORMAT_PATTERN = "{src,typings,tests}/**/*.{js,jsx,ts,tsx,scss}";
const LINT_TARGET = "src";

type CompatibilityConfig = {
  formatArgs: string[];
  lintArgs: string[];
  cleanup: () => Promise<void>;
};

type LintingCommand = "lint" | "lint:fix" | "format";

const OXFMT_CONFIG_FILE_NAMES = [
  ".oxfmtrc.json",
  ".oxfmtrc.jsonc",
  ".oxfmtrc.js",
  ".oxfmtrc.mjs",
  ".oxfmtrc.cjs",
  ".oxfmtrc.ts",
  ".oxfmtrc.mts",
  ".oxfmtrc.cts",
  "oxfmt.config.json",
  "oxfmt.config.jsonc",
  "oxfmt.config.js",
  "oxfmt.config.mjs",
  "oxfmt.config.cjs",
  "oxfmt.config.ts",
  "oxfmt.config.mts",
  "oxfmt.config.cts",
];

const OXLINT_CONFIG_FILE_NAMES = [
  ".oxlintrc.json",
  ".oxlintrc.jsonc",
  ".oxlintrc.js",
  ".oxlintrc.mjs",
  ".oxlintrc.cjs",
  ".oxlintrc.ts",
  ".oxlintrc.mts",
  ".oxlintrc.cts",
  "oxlint.config.json",
  "oxlint.config.jsonc",
  "oxlint.config.js",
  "oxlint.config.mjs",
  "oxlint.config.cjs",
  "oxlint.config.ts",
  "oxlint.config.mts",
  "oxlint.config.cts",
];

const PWT_OXFMT_CONFIG = {
  trailingComma: "none",
  useTabs: false,
  tabWidth: 4,
  semi: true,
  singleQuote: false,
  printWidth: 120,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "avoid",
  proseWrap: "always",
  xmlSelfClosingSpace: true,
  xmlWhitespaceSensitivity: "ignore",
  jsxSingleQuote: false,
  quoteProps: "as-needed",
  ignorePatterns: [],
};

const PWT_OXLINT_CONFIG = {
  plugins: ["typescript", "unicorn", "oxc"],
  categories: {
    correctness: "error",
  },
  rules: {},
  env: {
    builtin: true,
    browser: true,
    node: true,
  },
  ignorePatterns: [],
};

async function lintingCommand(
  command: LintingCommand,
  passthroughArgs: string[] = [],
) {
  const compatibilityConfig = await prepareCompatibilityConfig();

  try {
    if (command === "format") {
      await runFormat(true, compatibilityConfig, passthroughArgs);
      return;
    }

    const shouldWrite = command === "lint:fix";

    await runFormat(shouldWrite, compatibilityConfig);
    await runLint(shouldWrite, compatibilityConfig, passthroughArgs);
  } finally {
    await compatibilityConfig.cleanup();
  }
}

async function runFormat(
  shouldWrite: boolean,
  compatibilityConfig: CompatibilityConfig,
  passthroughArgs: string[] = [],
) {
  await runOxfmt([
    ...compatibilityConfig.formatArgs,
    FORMAT_PATTERN,
    shouldWrite ? "--write" : "--check",
    ...passthroughArgs,
  ]);
}

async function runLint(
  shouldWrite: boolean,
  compatibilityConfig: CompatibilityConfig,
  passthroughArgs: string[] = [],
) {
  await runOxlint([
    ...compatibilityConfig.lintArgs,
    LINT_TARGET,
    ...(shouldWrite ? ["--fix"] : []),
    ...passthroughArgs,
  ]);
}

async function prepareCompatibilityConfig(): Promise<CompatibilityConfig> {
  const [userOxfmtConfigPath, userOxlintConfigPath] = await Promise.all([
    findFormatConfig(),
    findUserConfig(OXLINT_CONFIG_FILE_NAMES),
  ]);
  const legacyConfigFiles = await findLegacyConfigFiles();

  let tempDirectory: string | undefined;
  const formatArgs = userOxfmtConfigPath
    ? ["--config", userOxfmtConfigPath]
    : [];
  const lintArgs = userOxlintConfigPath
    ? ["--config", userOxlintConfigPath]
    : [];

  async function ensureTempDirectory(): Promise<string> {
    tempDirectory ??= await fs.mkdtemp(path.join(os.tmpdir(), "hyper-pwt-ox-"));

    return tempDirectory;
  }

  if (!userOxfmtConfigPath) {
    const configPath = path.join(await ensureTempDirectory(), ".oxfmtrc.json");

    await fs.writeFile(
      configPath,
      `${JSON.stringify(PWT_OXFMT_CONFIG, null, 2)}\n`,
    );
    formatArgs.push("--config", configPath);
  }

  if (!userOxlintConfigPath) {
    const configPath = path.join(await ensureTempDirectory(), ".oxlintrc.json");

    await fs.writeFile(
      configPath,
      `${JSON.stringify(PWT_OXLINT_CONFIG, null, 2)}\n`,
    );
    lintArgs.push("--config", configPath);
  }

  if (legacyConfigFiles.length > 0 && tempDirectory) {
    showMessage(
      `Using oxlint/oxfmt compatibility settings for legacy ${legacyConfigFiles.join(
        ", ",
      )}.`,
    );
  }

  return {
    formatArgs,
    lintArgs,
    cleanup: async () => {
      if (tempDirectory) {
        await fs.rm(tempDirectory, { force: true, recursive: true });
      }
    },
  };
}

async function findFormatConfig(): Promise<string | undefined> {
  const userOxfmtConfigPath = await findUserConfig(OXFMT_CONFIG_FILE_NAMES);

  if (userOxfmtConfigPath) {
    return userOxfmtConfigPath;
  }

  const pwtRootPrettierConfigPath = path.join(
    PROJECT_DIRECTORY,
    "node_modules/prettier.config.js",
  );

  if (await pathIsExists(pwtRootPrettierConfigPath)) {
    return pwtRootPrettierConfigPath;
  }

  const userPrettierConfigPath = path.join(
    PROJECT_DIRECTORY,
    "prettier.config.js",
  );

  if (await pathIsExists(userPrettierConfigPath)) {
    return userPrettierConfigPath;
  }

  return undefined;
}

async function findUserConfig(
  fileNames: string[],
): Promise<string | undefined> {
  for (const fileName of fileNames) {
    const configPath = path.join(PROJECT_DIRECTORY, fileName);

    if (await pathIsExists(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

async function findLegacyConfigFiles(): Promise<string[]> {
  const files = [];

  for (const fileName of [".eslintrc.js", "prettier.config.js"]) {
    if (await pathIsExists(path.join(PROJECT_DIRECTORY, fileName))) {
      files.push(fileName);
    }
  }

  return files;
}

async function runOxfmt(args: string[]): Promise<void> {
  await runPackageBin("oxfmt", "bin/oxfmt", args, "oxfmt");
}

async function runOxlint(args: string[]): Promise<void> {
  await runPackageBin("oxlint", "bin/oxlint", args, "oxlint");
}

async function runPackageBin(
  packageName: string,
  binRelativePath: string,
  args: string[],
  displayName: string,
): Promise<void> {
  const packageJsonPath = requireFromCli.resolve(`${packageName}/package.json`);
  const binPath = path.join(path.dirname(packageJsonPath), binRelativePath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      cwd: PROJECT_DIRECTORY,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(
          new Error(`${displayName} was interrupted by signal ${signal}.`),
        );
        return;
      }

      if (code && code !== 0) {
        process.exitCode = code;
        reject(new Error(`${displayName} exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

export default lintingCommand;
