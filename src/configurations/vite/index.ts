import path from "node:path";
import react from "@vitejs/plugin-react";
import typescript from "rollup-plugin-typescript2";
import type { UserConfig } from "vite";
import type { PWTConfig } from "../..";
import { PROJECT_DIRECTORY, WEB_OUTPUT_DIRECTORY } from "../../constants";
import getViteOutputDirectory from "../../utils/getViteOutputDirectory";
import getWidgetName from "../../utils/getWidgetName";

export const getEditorConfigDefaultConfig = async (
  isProduction: boolean,
): Promise<UserConfig> => {
  const widgetName = await getWidgetName();

  return {
    plugins: [],
    build: {
      outDir: WEB_OUTPUT_DIRECTORY,
      minify: !!isProduction,
      emptyOutDir: false,
      sourcemap: !isProduction,
      lib: {
        entry: path.join(
          PROJECT_DIRECTORY,
          `/src/${widgetName}.editorConfig.ts`,
        ),
        name: `${widgetName}.editorConfig`,
        fileName: () => {
          return `${widgetName}.editorConfig.js`;
        },
        formats: ["umd"],
      },
    },
  };
};

export const getEditorPreviewDefaultConfig = async (
  isProduction: boolean,
): Promise<UserConfig> => {
  const widgetName = await getWidgetName();

  return {
    plugins: [
      react({
        jsxRuntime: "classic",
      }),
    ],
    define: {
      "process.env": {},
      "process.env.NODE_ENV": '"production"',
    },
    build: {
      outDir: WEB_OUTPUT_DIRECTORY,
      minify: !!isProduction,
      emptyOutDir: false,
      sourcemap: !isProduction,
      lib: {
        entry: path.join(
          PROJECT_DIRECTORY,
          `/src/${widgetName}.editorPreview.tsx`,
        ),
        name: `${widgetName}.editorPreview`,
        fileName: () => {
          return `${widgetName}.editorPreview.js`;
        },
        formats: ["umd"],
      },
      rolldownOptions: {
        external: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          /^mendix($|\/)/,
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
  };
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
        ...(userCustomConfig?.reactPluginOptions || {}),
        jsxRuntime: "classic",
      }),
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
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          /^mendix($|\/)/,
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
