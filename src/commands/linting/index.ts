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
const BIOME_FORMAT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

type BiomeCommand = "format" | "lint";
type CompatibilityConfig = {
  args: string[];
  cleanup: () => Promise<void>;
};

type LintingCommand = "lint" | "lint:fix" | "format";

const PWT_BIOME_CONFIG = {
  $schema: "https://biomejs.dev/schemas/2.4.14/schema.json",
  vcs: {
    enabled: false,
    clientKind: "git",
    root: PROJECT_DIRECTORY,
  },
  files: {
    ignoreUnknown: true,
  },
  formatter: {
    enabled: true,
    indentStyle: "space",
    indentWidth: 4,
    lineWidth: 120,
    bracketSpacing: true,
    bracketSameLine: false,
  },
  linter: {
    enabled: true,
    rules: {
      recommended: true,
      correctness: {
        noUnusedFunctionParameters: "off",
        useExhaustiveDependencies: "warn",
        useHookAtTopLevel: "warn",
      },
      suspicious: {
        noExplicitAny: "off",
      },
      style: {
        useImportType: "off",
      },
    },
  },
  javascript: {
    formatter: {
      quoteStyle: "double",
      jsxQuoteStyle: "double",
      trailingCommas: "none",
      semicolons: "always",
      arrowParentheses: "asNeeded",
      bracketSpacing: true,
      bracketSameLine: false,
      indentStyle: "space",
      indentWidth: 4,
      lineWidth: 120,
    },
  },
  css: {
    formatter: {
      quoteStyle: "double",
      indentStyle: "space",
      indentWidth: 4,
      lineWidth: 120,
    },
  },
  assist: {
    enabled: true,
    actions: {
      source: {
        organizeImports: "on",
      },
    },
  },
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
  const biomeFiles = files.filter((file) =>
    BIOME_FORMAT_EXTENSIONS.has(path.extname(file)),
  );
  const unsupportedFiles = files.filter(
    (file) => !BIOME_FORMAT_EXTENSIONS.has(path.extname(file)),
  );

  if (unsupportedFiles.length > 0) {
    showMessage(
      `Skipping ${unsupportedFiles.length} SCSS file(s) because Biome does not format SCSS yet.`,
    );
  }

  if (biomeFiles.length === 0) {
    showMessage("No matching files found for format.");
    return;
  }

  await runBiome("format", [
    ...compatibilityConfig.args,
    "--files-ignore-unknown=true",
    "--no-errors-on-unmatched",
    ...(shouldWrite ? ["--write"] : []),
    ...biomeFiles,
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

  await runBiome("lint", [
    ...compatibilityConfig.args,
    "--files-ignore-unknown=true",
    "--no-errors-on-unmatched",
    ...(shouldWrite ? ["--write"] : []),
    ...files,
    ...passthroughArgs,
  ]);
}

async function prepareCompatibilityConfig(): Promise<CompatibilityConfig> {
  const userBiomeConfigPath = await findUserBiomeConfig();

  if (userBiomeConfigPath) {
    return {
      args: ["--config-path", userBiomeConfigPath],
      cleanup: async () => {},
    };
  }

  const legacyConfigFiles = await findLegacyConfigFiles();

  if (legacyConfigFiles.length > 0) {
    showMessage(
      `Using Biome compatibility settings for legacy ${legacyConfigFiles.join(
        ", ",
      )}.`,
    );
  }

  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "hyper-pwt-biome-"),
  );
  const configPath = path.join(tempDirectory, "biome.json");

  await fs.writeFile(
    configPath,
    `${JSON.stringify(PWT_BIOME_CONFIG, null, 2)}\n`,
  );

  return {
    args: ["--config-path", configPath],
    cleanup: async () => {
      await fs.rm(tempDirectory, { force: true, recursive: true });
    },
  };
}

async function findUserBiomeConfig(): Promise<string | undefined> {
  for (const fileName of ["biome.json", "biome.jsonc"]) {
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

async function runBiome(command: BiomeCommand, args: string[]): Promise<void> {
  const biomeBinPath = requireFromCli.resolve("@biomejs/biome/bin/biome");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [biomeBinPath, command, ...args], {
      cwd: PROJECT_DIRECTORY,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Biome was interrupted by signal ${signal}.`));
        return;
      }

      if (code && code !== 0) {
        process.exitCode = code;
        reject(new Error(`Biome exited with code ${code}.`));
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
