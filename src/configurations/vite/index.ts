import fs from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import typescript from "rollup-plugin-typescript2";
import type { PluginOption, UserConfig } from "vite";
import type { PWTConfig } from "../..";
import { PROJECT_DIRECTORY, WEB_OUTPUT_DIRECTORY } from "../../constants";
import getViteOutputDirectory from "../../utils/getViteOutputDirectory";
import getWidgetName from "../../utils/getWidgetName";
import { mendixDependenciesLicensePlugin } from "./plugins/mendix-dependencies-license-plugin";

const commonExternalLibs = [
  /^mendix($|\/)/,
  /^react$/,
  /^react\/jsx-runtime$/,
  /^react-dom$/,
];

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const resolveWidgetSourceEntry = async (
  widgetName: string,
  matcher: RegExp,
) => {
  const sourceDirectory = path.join(PROJECT_DIRECTORY, "src");
  const sourceFiles = await fs.readdir(sourceDirectory);
  const entry = sourceFiles.find((file) => matcher.test(file));

  return entry ? path.join(sourceDirectory, entry) : undefined;
};

const importTypeScript = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<typeof import("typescript")>;
let typescriptModulePromise: Promise<typeof import("typescript")> | undefined;

const loadTypeScript = () => {
  typescriptModulePromise ??= importTypeScript("typescript");

  return typescriptModulePromise;
};

const mendixEditorConfigEs5OutputPlugin = (): PluginOption => {
  return {
    name: "mendix-editor-config-es5-output-plugin",
    async generateBundle(_options, bundle) {
      const ts = await loadTypeScript();

      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") {
          continue;
        }

        const transpiled = ts.transpileModule(output.code, {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES5,
          },
        });

        output.code = transpiled.outputText.trimEnd();
      }
    },
  };
};

export const resolveEditorConfigEntry = async (widgetName: string) => {
  return resolveWidgetSourceEntry(
    widgetName,
    new RegExp(`^${escapeRegExp(widgetName)}\\.editorConfig\\.[jt]s$`, "i"),
  );
};

export const resolveEditorPreviewEntry = async (widgetName: string) => {
  return resolveWidgetSourceEntry(
    widgetName,
    new RegExp(
      `^${escapeRegExp(widgetName)}\\.(webmodeler|editorPreview)\\.[jt]sx?$`,
      "i",
    ),
  );
};

export const getEditorConfigDefaultConfig = async (
  isProduction: boolean,
  outDir: string = WEB_OUTPUT_DIRECTORY,
): Promise<UserConfig | undefined> => {
  const widgetName = await getWidgetName();
  const editorConfigEntry = await resolveEditorConfigEntry(widgetName);

  if (!editorConfigEntry) {
    return undefined;
  }

  return {
    plugins: [mendixEditorConfigEs5OutputPlugin()],
    build: {
      outDir,
      target: "es2015",
      minify: !!isProduction,
      emptyOutDir: false,
      sourcemap: false,
      lib: {
        entry: editorConfigEntry,
        fileName: () => {
          return `${widgetName}.editorConfig.js`;
        },
        formats: ["cjs"],
      },
      rolldownOptions: {
        external: commonExternalLibs,
        output: {
          banner: "'use strict';",
          esModule: false,
          generatedCode: {
            preset: "es5",
            symbols: false,
          },
        },
        treeshake: {
          moduleSideEffects: false,
        },
      },
    },
  };
};

export const getEditorPreviewDefaultConfig = async (
  isProduction: boolean,
  outDir: string = WEB_OUTPUT_DIRECTORY,
): Promise<UserConfig | undefined> => {
  const widgetName = await getWidgetName();
  const editorPreviewEntry = await resolveEditorPreviewEntry(widgetName);

  if (!editorPreviewEntry) {
    return undefined;
  }

  return {
    plugins: [
      react({
        jsxRuntime: "automatic",
      }),
    ],
    define: {
      "process.env": {},
      "process.env.NODE_ENV": '"production"',
    },
    build: {
      outDir,
      minify: !!isProduction,
      emptyOutDir: false,
      sourcemap: !isProduction ? "inline" : false,
      lib: {
        entry: editorPreviewEntry,
        fileName: () => {
          return `${widgetName}.editorPreview.js`;
        },
        formats: ["cjs"],
      },
      rolldownOptions: {
        external: commonExternalLibs,
        output: {
          banner: "'use strict';",
          esModule: false,
          generatedCode: {
            preset: "es5",
            symbols: false,
          },
        },
      },
    },
  };
};

export const getDesignTimeDefaultConfigs = async (
  isProduction: boolean,
  outDir: string = WEB_OUTPUT_DIRECTORY,
): Promise<UserConfig[]> => {
  const configs = await Promise.all([
    getEditorConfigDefaultConfig(isProduction, outDir),
    getEditorPreviewDefaultConfig(isProduction, outDir),
  ]);

  return configs.filter((config): config is UserConfig => !!config);
};

export const getViteDefaultConfig = async (
  isProduction: boolean,
  userCustomConfig?: PWTConfig,
): Promise<UserConfig> => {
  const widgetName = await getWidgetName();
  const viteOutputDirectory = await getViteOutputDirectory();

  return {
    plugins: [
      react({
        ...userCustomConfig?.reactPluginOptions,
        jsxRuntime: "classic",
      }),
      ...(isProduction
        ? [
            mendixDependenciesLicensePlugin({
              outputDir: WEB_OUTPUT_DIRECTORY,
              projectDir: PROJECT_DIRECTORY,
            }),
          ]
        : []),
    ],
    define: {
      "process.env": {},
      "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
    },
    build: {
      outDir: viteOutputDirectory,
      minify: !!isProduction,
      cssMinify: !!isProduction,
      sourcemap: !isProduction,
      lib: {
        formats: ["es", "umd"],
        entry: path.join(PROJECT_DIRECTORY, `/src/${widgetName}.tsx`),
        name: widgetName,
        fileName: (format, entry) => {
          if (format === "umd") {
            return `${widgetName}.js`;
          }

          if (format === "es") {
            return `${widgetName}.mjs`;
          }

          return entry;
        },
        cssFileName: widgetName,
      },
      rolldownOptions: {
        plugins: [
          typescript({
            tsconfig: path.join(PROJECT_DIRECTORY, "tsconfig.json"),
            tsconfigOverride: {
              compilerOptions: {
                jsx: "preserve",
                preserveConstEnums: false,
                isolatedModules: false,
                declaration: false,
              },
            },
            include: ["src/**/*.ts", "src/**/*.tsx"],
            exclude: ["node_modules/**", "src/**/*.d.ts"],
            check: false,
          }),
        ],
        external: [
          ...commonExternalLibs,
          "react-dom/client",
          "react/jsx-dev-runtime",
        ],
        output: {
          globals: {
            react: "React",
            "react-dom": "ReactDOM",
            "react-dom/client": "ReactDOM",
          },
        },
      },
    },
    ...userCustomConfig,
  };
};
