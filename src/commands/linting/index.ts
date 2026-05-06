import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { PROJECT_DIRECTORY } from "../../constants";
import pathIsExists from "../../utils/pathIsExists";
import showMessage from "../../utils/showMessage";

const requireFromCli = createRequire(import.meta.url);

const FORMAT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".scss"]);
const LINT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const FORMAT_DIRECTORIES = ["src", "typings", "tests"];
const LINT_DIRECTORIES = ["src"];

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
  useTabs: false,
  tabWidth: 4,
  printWidth: 120,
  singleQuote: false,
  jsxSingleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "none",
  semi: true,
  arrowParens: "avoid",
  bracketSameLine: false,
  bracketSpacing: true,
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
  const normalizedPassthroughArgs = removePwtCompatibilityArgs(passthroughArgs);

  try {
    if (command === "format") {
      await runFormat(true, compatibilityConfig, normalizedPassthroughArgs);
      return;
    }

    const shouldWrite = command === "lint:fix";

    await runFormat(shouldWrite, compatibilityConfig);
    await runLint(shouldWrite, compatibilityConfig, normalizedPassthroughArgs);
  } finally {
    await compatibilityConfig.cleanup();
  }
}

async function runFormat(
  shouldWrite: boolean,
  compatibilityConfig: CompatibilityConfig,
  passthroughArgs: string[] = [],
) {
  const files = await findMatchingFiles(FORMAT_DIRECTORIES, FORMAT_EXTENSIONS, {
    usePrettierIgnore: true,
  });

  if (files.length === 0) {
    showMessage("No matching files found for format.");
    return;
  }

  await runOxfmt([
    ...compatibilityConfig.formatArgs,
    "--no-error-on-unmatched-pattern",
    shouldWrite ? "--write" : "--check",
    ...files,
    ...passthroughArgs,
  ]);
}

async function runLint(
  shouldWrite: boolean,
  compatibilityConfig: CompatibilityConfig,
  passthroughArgs: string[] = [],
) {
  const files = await findMatchingFiles(LINT_DIRECTORIES, LINT_EXTENSIONS);

  if (files.length === 0) {
    showMessage("No matching files found for lint.");
    return;
  }

  await runOxlint([
    ...compatibilityConfig.lintArgs,
    "--no-error-on-unmatched-pattern",
    ...(shouldWrite ? ["--fix"] : []),
    ...files,
    ...passthroughArgs,
  ]);
}

async function prepareCompatibilityConfig(): Promise<CompatibilityConfig> {
  const [userOxfmtConfigPath, userOxlintConfigPath] = await Promise.all([
    findUserConfig(OXFMT_CONFIG_FILE_NAMES),
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

async function findMatchingFiles(
  directoryNames: string[],
  extensions: Set<string>,
  options: { usePrettierIgnore?: boolean } = {},
): Promise<string[]> {
  const prettierIgnorePatterns = options.usePrettierIgnore
    ? await readPrettierIgnorePatterns()
    : [];
  const files = [];

  for (const directoryName of directoryNames) {
    const directoryPath = path.join(PROJECT_DIRECTORY, directoryName);

    if (!(await pathIsExists(directoryPath))) {
      continue;
    }

    const directoryFiles = await findFilesInDirectory(
      directoryPath,
      extensions,
      prettierIgnorePatterns,
    );

    files.push(...directoryFiles);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function removePwtCompatibilityArgs(args: string[]): string[] {
  const result = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--subprojectPath") {
      index += 1;
      continue;
    }

    if (arg.startsWith("--subprojectPath=")) {
      continue;
    }

    if (arg === "--skip-migration") {
      continue;
    }

    result.push(arg);
  }

  return result;
}

async function findFilesInDirectory(
  directoryPath: string,
  extensions: Set<string>,
  prettierIgnorePatterns: string[],
): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    const relativePath = toRelativePath(entryPath);

    if (isIgnoredByPrettierIgnore(relativePath, prettierIgnorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(
        ...(await findFilesInDirectory(
          entryPath,
          extensions,
          prettierIgnorePatterns,
        )),
      );
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

async function readPrettierIgnorePatterns(): Promise<string[]> {
  const prettierIgnorePath = path.join(PROJECT_DIRECTORY, ".prettierignore");

  if (!(await pathIsExists(prettierIgnorePath))) {
    return [];
  }

  const contents = await fs.readFile(prettierIgnorePath, "utf8");

  return contents
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function isIgnoredByPrettierIgnore(
  relativePath: string,
  patterns: string[],
): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      continue;
    }

    const normalizedPattern = normalizePath(pattern).replace(/^\.?\//, "");

    if (normalizedPattern.endsWith("/")) {
      const directoryPattern = normalizedPattern.slice(0, -1);

      if (
        relativePath === directoryPattern ||
        relativePath.startsWith(`${directoryPattern}/`)
      ) {
        return true;
      }

      continue;
    }

    if (
      relativePath === normalizedPattern ||
      relativePath.startsWith(`${normalizedPattern}/`)
    ) {
      return true;
    }
  }

  return false;
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

function toRelativePath(filePath: string): string {
  return normalizePath(path.relative(PROJECT_DIRECTORY, filePath));
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export default lintingCommand;
