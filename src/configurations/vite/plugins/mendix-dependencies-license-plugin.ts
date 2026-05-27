import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const DEPENDENCIES_JSON_FILENAME = "dependencies.json";
const DEPENDENCIES_TEXT_FILENAME = "dependencies.txt";
const EOL = "\n";

type PackageJsonData = {
  name?: string;
  version?: string;
  description?: string;
  repository?: string | { url?: string };
  homepage?: string | null;
  private?: boolean;
  license?: string | null;
  licenses?: Array<string | { type?: string }> | string;
  licenseText?: string;
  noticeText?: string;
  author?: string | PersonData;
  contributors?: Array<string | PersonData> | string | PersonData;
};

type PersonData = {
  name?: string;
  email?: string;
  url?: string;
};

type Dependency = {
  name: string | null;
  version: string | null;
  description: string | null;
  repository: string | { url?: string } | null;
  homepage: string | null;
  private: boolean;
  license: string | null;
  licenseText: string | null;
  noticeText: string | null;
  author: PersonData | null;
  contributors: PersonData[];
};

type TextDirent = {
  name: string;
  isFile(): boolean;
  isSymbolicLink(): boolean;
};

const isValidPackageName = (name: string) => {
  return /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name);
};

const stripModuleId = (id: string) => {
  const withoutNullPrefix = id.charCodeAt(0) === 0 ? id.slice(1) : id;

  return withoutNullPrefix.split("?")[0].split("#")[0];
};

const pathsEqual = (a: string, b: string) => {
  return path.resolve(a) === path.resolve(b);
};

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (typeof value === "undefined") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const parsePerson = (person: string | PersonData): PersonData => {
  if (typeof person !== "string") {
    return {
      name: person.name ?? null,
      email: person.email ?? null,
      url: person.url ?? null,
    } as PersonData;
  }

  const result: Record<string, string> = {};
  let current: "name" | "email" | "url" = "name";

  for (let i = 0; i < person.length; i += 1) {
    const character = person.charAt(i);

    if (character === "<") {
      current = "email";
    } else if (character === "(") {
      current = "url";
    } else if (character !== ")" && character !== ">") {
      result[current] = (result[current] ?? "") + character;
    }
  }

  return {
    name: result.name?.trim() || null,
    email: result.email?.trim() || null,
    url: result.url?.trim() || null,
  } as PersonData;
};

const formatPerson = (person: PersonData) => {
  let text = `${person.name}`;

  if (person.email) {
    text += ` <${person.email}>`;
  }

  if (person.url) {
    text += ` (${person.url})`;
  }

  return text;
};

const normalizeLicense = (packageJson: PackageJsonData) => {
  if (packageJson.license) {
    return packageJson.license;
  }

  if (Array.isArray(packageJson.licenses)) {
    return `(${packageJson.licenses
      .map((license) =>
        typeof license === "string" ? license : license.type || license,
      )
      .join(" OR ")})`;
  }

  return null;
};

const createDependency = (packageJson: PackageJsonData): Dependency => {
  return {
    name: packageJson.name ?? null,
    version: packageJson.version ?? null,
    description: packageJson.description ?? null,
    repository: packageJson.repository ?? null,
    homepage: packageJson.homepage ?? null,
    private: packageJson.private ?? false,
    license: normalizeLicense(packageJson),
    licenseText: packageJson.licenseText ?? null,
    noticeText: packageJson.noticeText ?? null,
    author: packageJson.author ? parsePerson(packageJson.author) : null,
    contributors: toArray(packageJson.contributors).map(parsePerson),
  };
};

const dependencyToText = (dependency: Dependency) => {
  const lines: string[] = [];

  lines.push(`Name: ${dependency.name}`);
  lines.push(`Version: ${dependency.version}`);
  lines.push(`License: ${dependency.license}`);
  lines.push(`Private: ${dependency.private}`);

  if (dependency.description) {
    lines.push(`Description: ${dependency.description || false}`);
  }

  if (dependency.repository) {
    lines.push(
      `Repository: ${
        typeof dependency.repository === "string"
          ? undefined
          : dependency.repository.url
      }`,
    );
  }

  if (dependency.homepage) {
    lines.push(`Homepage: ${dependency.homepage}`);
  }

  if (dependency.author) {
    lines.push(`Author: ${formatPerson(dependency.author)}`);
  }

  if (dependency.contributors.length > 0) {
    lines.push("Contributors:");
    lines.push(
      ...dependency.contributors.map(
        (contributor) => `  ${formatPerson(contributor)}`,
      ),
    );
  }

  if (dependency.licenseText) {
    lines.push("License Copyright:");
    lines.push("===");
    lines.push("");
    lines.push(dependency.licenseText);
    lines.push("");
  }

  if (dependency.noticeText) {
    lines.push("Notice:");
    lines.push("===");
    lines.push("");
    lines.push(dependency.noticeText);
    lines.push("");
  }

  return lines.join(EOL).trim();
};

const matchesPackageTextFile = (fileName: string, target: string) => {
  const normalized = fileName.toLowerCase();
  const prefix = target.toLowerCase();

  if (!normalized.startsWith(prefix)) {
    return false;
  }

  return !/[#%&*:<>?/{}|]/.test(fileName.slice(prefix.length));
};

const readPackageTextFile = async (dir: string, targets: string[]) => {
  let entries: TextDirent[];

  try {
    entries = (await fs.readdir(dir, {
      encoding: "utf8",
      withFileTypes: true,
    })) as TextDirent[];
  } catch {
    return null;
  }

  for (const target of targets) {
    const entry = entries.find(
      (candidate) =>
        (candidate.isFile() || candidate.isSymbolicLink()) &&
        matchesPackageTextFile(candidate.name, target),
    );

    if (entry) {
      return fs.readFile(path.join(dir, entry.name), "utf-8");
    }
  }

  return null;
};

const readPackageJson = async (dir: string) => {
  try {
    const packageJsonPath = path.join(dir, "package.json");
    const packageJson = JSON.parse(
      await fs.readFile(packageJsonPath, "utf-8"),
    ) as PackageJsonData;
    const license = packageJson.license || packageJson.licenses;
    const hasLicense =
      typeof license === "string"
        ? license.length > 0
        : Array.isArray(license) && license.length > 0;
    const hasValidPackageIdentity =
      !!packageJson.name &&
      isValidPackageName(packageJson.name) &&
      !!packageJson.version;

    if (!hasValidPackageIdentity && !hasLicense) {
      return null;
    }

    const licenseText = await readPackageTextFile(dir, ["license", "licence"]);
    const noticeText = await readPackageTextFile(dir, ["notice"]);

    return {
      ...packageJson,
      ...(licenseText ? { licenseText } : null),
      ...(noticeText ? { noticeText } : null),
    };
  } catch {
    return null;
  }
};

const getRenderableModuleIds = (chunk: {
  modules?: Record<string, { isAsset?: boolean; renderedLength?: number }>;
}) => {
  if (!chunk.modules) {
    return [];
  }

  return Object.entries(chunk.modules)
    .filter(([, moduleInfo]) => {
      if (moduleInfo?.isAsset) {
        return false;
      }

      return (
        typeof moduleInfo?.renderedLength !== "number" ||
        moduleInfo.renderedLength > 0
      );
    })
    .map(([moduleId]) => moduleId);
};

export function mendixDependenciesLicensePlugin(options: {
  outputDir: string;
  projectDir: string;
}): Plugin {
  const dependencies = new Map<string, Dependency>();
  const packageCache = new Map<string, PackageJsonData | null>();

  const addDependency = (packageJson: PackageJsonData) => {
    if (!packageJson.name || dependencies.has(packageJson.name)) {
      return;
    }

    dependencies.set(packageJson.name, createDependency(packageJson));
  };

  const scanDependency = async (moduleId: string) => {
    const normalizedModuleId = stripModuleId(moduleId);

    if (!normalizedModuleId || normalizedModuleId.startsWith("virtual:")) {
      return;
    }

    let dir = path.resolve(path.parse(normalizedModuleId).dir);
    const scannedDirs = new Set<string>();

    while (dir && !scannedDirs.has(dir)) {
      if (pathsEqual(dir, options.projectDir)) {
        break;
      }

      if (packageCache.has(dir)) {
        const packageJson = packageCache.get(dir);

        if (packageJson) {
          addDependency(packageJson);
        }

        break;
      }

      scannedDirs.add(dir);

      const packageJson = await readPackageJson(dir);

      if (packageJson) {
        for (const scannedDir of scannedDirs) {
          packageCache.set(scannedDir, packageJson);
        }

        addDependency(packageJson);
        break;
      }

      dir = path.resolve(path.join(dir, ".."));
    }

    for (const scannedDir of scannedDirs) {
      if (!packageCache.has(scannedDir)) {
        packageCache.set(scannedDir, null);
      }
    }
  };

  const writeDependencyFiles = async () => {
    const dependencyList = [...dependencies.values()];
    const textContent =
      dependencyList.length === 0
        ? "No third parties dependencies"
        : dependencyList
            .map(dependencyToText)
            .join(`${EOL}${EOL}---${EOL}${EOL}`);
    const jsonContent = JSON.stringify(
      dependencyList.map((dependency) => ({
        [dependency.name as string]: {
          version: dependency.version,
          url: dependency.homepage,
        },
      })),
    );

    await fs.mkdir(options.outputDir, { recursive: true });
    await Promise.all([
      fs.writeFile(
        path.join(options.outputDir, DEPENDENCIES_TEXT_FILENAME),
        textContent.trim(),
      ),
      fs.writeFile(
        path.join(options.outputDir, DEPENDENCIES_JSON_FILENAME),
        jsonContent.trim(),
      ),
    ]);
  };

  return {
    name: "mendix-dependencies-license",
    async renderChunk(_code, chunk, outputOptions) {
      if (outputOptions.format !== "umd") {
        return null;
      }

      for (const moduleId of getRenderableModuleIds(chunk)) {
        await scanDependency(moduleId);
      }

      return null;
    },
    async generateBundle(outputOptions) {
      if (outputOptions.format !== "umd") {
        return;
      }

      await writeDependencyFiles();
    },
  };
}
