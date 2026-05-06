import fs from "node:fs/promises";
import path from "node:path";
import typescript from "rollup-plugin-typescript2";
import {
  build as viteBuild,
  createServer,
  type InlineConfig,
  type PluginOption,
  type UserConfig,
} from "vite";
import {
  getDesignTimeDefaultConfigs,
  getViteDefaultConfig,
} from "../../../configurations/vite";
import { mendixHotreloadReactPlugin } from "../../../configurations/vite/plugins/mendix-hotreload-react-plugin";
import { mendixPatchViteClientPlugin } from "../../../configurations/vite/plugins/mendix-patch-vite-client-plugin";
import {
  CLI_DIRECTORY,
  COLOR_ERROR,
  COLOR_GREEN,
  PROJECT_DIRECTORY,
  VITE_CONFIGURATION_FILENAME,
} from "../../../constants";
import { generateTypesFromFile } from "../../../type-generator";
import getMendixProjectDirectory from "../../../utils/getMendixProjectDirectory";
import getViteUserConfiguration from "../../../utils/getViteUserConfiguration";
import getViteWatchOutputDirectory from "../../../utils/getViteWatchOutputDirectory";
import getWidgetName from "../../../utils/getWidgetName";
import getWidgetPackageJson from "../../../utils/getWidgetPackageJson";
import pathIsExists from "../../../utils/pathIsExists";
import showMessage from "../../../utils/showMessage";

const generateTyping = async () => {
  const widgetName = await getWidgetName();
  const originWidgetXmlPath = path.join(
    PROJECT_DIRECTORY,
    `src/${widgetName}.xml`,
  );
  const typingsPath = path.join(PROJECT_DIRECTORY, "typings");
  const typingsDirExists = await pathIsExists(typingsPath);

  if (typingsDirExists) {
    await fs.rm(typingsPath, {
      recursive: true,
      force: true,
    });
  }

  await fs.mkdir(typingsPath);

  const newTypingsFilePath = path.join(typingsPath, `${widgetName}Props.d.ts`);
  const typingContents = await generateTypesFromFile(
    originWidgetXmlPath,
    "web",
  );

  await fs.writeFile(newTypingsFilePath, typingContents);
};

const resolveWidgetEntry = async (widgetName: string) => {
  const candidates = [
    {
      ext: ".tsx",
      path: path.join(PROJECT_DIRECTORY, "src", `${widgetName}.tsx`),
    },
    {
      ext: ".ts",
      path: path.join(PROJECT_DIRECTORY, "src", `${widgetName}.ts`),
    },
    {
      ext: ".jsx",
      path: path.join(PROJECT_DIRECTORY, "src", `${widgetName}.jsx`),
    },
    {
      ext: ".js",
      path: path.join(PROJECT_DIRECTORY, "src", `${widgetName}.js`),
    },
  ];

  for (const candidate of candidates) {
    if (await pathIsExists(candidate.path)) {
      return `src/${widgetName}${candidate.ext}`;
    }
  }

  throw new Error(
    `Widget entry file not found. Expected one of: ${candidates
      .map((candidate) => candidate.path)
      .join(", ")}`,
  );
};

const ensureTrailingSlash = (value: string) => {
  if (!value) return value;
  return value.endsWith("/") ? value : `${value}/`;
};

const syncDeploymentMetadata = async (widgetName: string) => {
  const mendixProjectDirectory = await getMendixProjectDirectory();
  const widgetsRoot = path.join(
    mendixProjectDirectory,
    "deployment/web/widgets",
  );
  const packageXmlSource = path.join(PROJECT_DIRECTORY, "src/package.xml");
  const widgetXmlSource = path.join(PROJECT_DIRECTORY, `src/${widgetName}.xml`);

  await fs.mkdir(widgetsRoot, { recursive: true });

  if (await pathIsExists(packageXmlSource)) {
    await fs.copyFile(packageXmlSource, path.join(widgetsRoot, "package.xml"));
  }

  if (await pathIsExists(widgetXmlSource)) {
    await fs.copyFile(
      widgetXmlSource,
      path.join(widgetsRoot, `${widgetName}.xml`),
    );
  }
};

const buildDesignTimeArtifacts = async () => {
  const mendixProjectDirectory = await getMendixProjectDirectory();
  const widgetsRoot = path.join(
    mendixProjectDirectory,
    "deployment/web/widgets",
  );
  const designTimeViteConfigs = await getDesignTimeDefaultConfigs(
    false,
    widgetsRoot,
  );
  const viteBuildConfigs: InlineConfig[] = designTimeViteConfigs.map(
    (config): InlineConfig => ({
      ...config,
      configFile: false,
      root: PROJECT_DIRECTORY,
      logLevel: "silent",
    }),
  );

  await fs.mkdir(widgetsRoot, { recursive: true });
  await Promise.all(
    viteBuildConfigs.map(async (config) => {
      await viteBuild(config);
    }),
  );
};

const isDesignTimeSource = (file: string) => {
  const relativePath = path
    .relative(PROJECT_DIRECTORY, file)
    .split(path.sep)
    .join("/");

  return (
    relativePath.startsWith("src/") &&
    /\.(css|js|jsx|sass|scss|svg|ts|tsx|xml)$/i.test(relativePath)
  );
};

const startWebCommand = async () => {
  try {
    showMessage("Start widget server");

    await generateTyping();

    const customViteConfigPath = path.join(
      PROJECT_DIRECTORY,
      VITE_CONFIGURATION_FILENAME,
    );
    const viteConfigIsExists = await pathIsExists(customViteConfigPath);
    let resultViteConfig: UserConfig;
    const widgetName = await getWidgetName();
    const widgetEntry = await resolveWidgetEntry(widgetName);

    if (viteConfigIsExists) {
      const userConfig = await getViteUserConfiguration(customViteConfigPath);

      resultViteConfig = await getViteDefaultConfig(false, userConfig);
    } else {
      resultViteConfig = await getViteDefaultConfig(false);
    }

    const viteCachePath = path.join(PROJECT_DIRECTORY, "node_modules/.vite");
    const viteCachePathExists = await pathIsExists(viteCachePath);

    if (viteCachePathExists) {
      await fs.rm(viteCachePath, {
        recursive: true,
        force: true,
      });
    }

    const packageJson = await getWidgetPackageJson();
    const devPort = packageJson.config?.developmentPort;
    const reactDeps = [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ];
    const existingOptimizeDepsExclude = Array.isArray(
      resultViteConfig.optimizeDeps?.exclude,
    )
      ? resultViteConfig.optimizeDeps?.exclude
      : [];
    const optimizeDepsExclude = Array.from(
      new Set([...existingOptimizeDepsExclude, ...reactDeps]),
    );
    const serverConfig = resultViteConfig.server ?? {};
    let designTimeBuildTimer: NodeJS.Timeout | undefined;
    const scheduleDesignTimeBuild = () => {
      if (designTimeBuildTimer) {
        clearTimeout(designTimeBuildTimer);
      }

      designTimeBuildTimer = setTimeout(() => {
        designTimeBuildTimer = undefined;
        buildDesignTimeArtifacts().catch((error: unknown) => {
          showMessage(
            `${COLOR_ERROR("Design-time bundle build failed.")}\nError occurred: ${COLOR_ERROR(
              (error as Error).message,
            )}`,
          );
        });
      }, 100);
    };

    const viteServer = await createServer({
      ...resultViteConfig,
      root: PROJECT_DIRECTORY,
      optimizeDeps: {
        ...resultViteConfig.optimizeDeps,
        exclude: optimizeDepsExclude,
      },
      server: {
        ...serverConfig,
        port: devPort ?? serverConfig.port,
        cors: true,
        fs: {
          strict: false,
          ...serverConfig.fs,
        },
        watch: {
          usePolling: true,
          interval: 100,
          ...serverConfig.watch,
        },
      },
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
        mendixHotreloadReactPlugin(),
        ...(resultViteConfig.plugins as PluginOption[]),
        mendixPatchViteClientPlugin(),
        {
          name: "mendix-xml-watch-plugin",
          configureServer(server) {
            server.watcher.on("change", (file) => {
              if (file.endsWith("xml")) {
                generateTyping()
                  .then(() => {
                    scheduleDesignTimeBuild();
                  })
                  .catch((error: unknown) => {
                    showMessage(
                      `${COLOR_ERROR("Type generation failed.")}\nError occurred: ${COLOR_ERROR(
                        (error as Error).message,
                      )}`,
                    );
                  });
              }
            });
          },
        },
        {
          name: "mendix-design-time-watch-plugin",
          configureServer(server) {
            for (const event of ["add", "change", "unlink"] as const) {
              server.watcher.on(event, (file) => {
                if (!file.endsWith("xml") && isDesignTimeSource(file)) {
                  scheduleDesignTimeBuild();
                }
              });
            }
          },
        },
      ],
    });

    await viteServer.listen();

    showMessage("Generate hot reload widget");

    const hotReloadTemplate = path.join(
      CLI_DIRECTORY,
      "src/configurations/hotReload/widget.proxy.js.template",
    );
    const hotReloadContents = await fs.readFile(hotReloadTemplate, "utf-8");
    const resolvedLocalUrl = viteServer.resolvedUrls?.local?.[0] || "";
    const resolvedNetworkUrl = viteServer.resolvedUrls?.network?.[0] || "";
    const configuredOrigin =
      typeof viteServer.config.server.origin === "string"
        ? viteServer.config.server.origin
        : "";
    const devServerUrl = ensureTrailingSlash(
      configuredOrigin || resolvedLocalUrl || resolvedNetworkUrl,
    );
    if (!devServerUrl) {
      throw new Error(
        "Unable to resolve Vite dev server URL. Configure `server.origin` in vite.config.mjs or ensure the dev server can report resolved URLs.",
      );
    }
    const newHotReloadContents = hotReloadContents
      .replaceAll("{{ WIDGET_NAME }}", widgetName)
      .replaceAll("{{ DEV_SERVER_URL }}", devServerUrl)
      .replaceAll("{{ WIDGET_ENTRY }}", widgetEntry);

    const distDir = await getViteWatchOutputDirectory();
    const hotReloadWidgetPath = path.join(distDir, `${widgetName}.mjs`);
    const dummyCssPath = path.join(distDir, `${widgetName}.css`);

    await fs.mkdir(distDir, {
      recursive: true,
    });
    await fs.writeFile(hotReloadWidgetPath, newHotReloadContents);
    await fs.writeFile(dummyCssPath, "");

    await syncDeploymentMetadata(widgetName);
    await buildDesignTimeArtifacts();

    showMessage(`${COLOR_GREEN("Widget hot reload is ready!")}`);
    showMessage(
      `${COLOR_GREEN("Mendix webpage will refresh shortly. Hot reload will work after refreshing.")}`,
    );
  } catch (error) {
    showMessage(
      `${COLOR_ERROR("Build failed.")}\nError occurred: ${COLOR_ERROR((error as Error).message)}`,
    );
    process.exitCode = 1;
    throw error;
  }
};

export default startWebCommand;
