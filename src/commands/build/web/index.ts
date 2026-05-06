import fs from "node:fs/promises";
import path from "node:path";
import { type InlineConfig, type UserConfig, build as viteBuild } from "vite";
import { zip } from "zip-a-folder";
import {
  getDesignTimeDefaultConfigs,
  getViteDefaultConfig,
} from "../../../configurations/vite";
import {
  COLOR_ERROR,
  COLOR_GREEN,
  DIST_DIRECTORY_NAME,
  PROJECT_DIRECTORY,
  VITE_CONFIGURATION_FILENAME,
  WEB_OUTPUT_DIRECTORY,
} from "../../../constants";
import { generateTypesFromFile } from "../../../type-generator";
import getMendixWidgetDirectory from "../../../utils/getMendixWidgetDirectory";
import getViteUserConfiguration from "../../../utils/getViteUserConfiguration";
import getWidgetName from "../../../utils/getWidgetName";
import getWidgetPackageJson from "../../../utils/getWidgetPackageJson";
import getWidgetVersion from "../../../utils/getWidgetVersion";
import pathIsExists from "../../../utils/pathIsExists";
import showMessage from "../../../utils/showMessage";

const buildWebCommand = async (isProduction: boolean = false) => {
  try {
    showMessage("Generate types");

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

    const newTypingsFilePath = path.join(
      typingsPath,
      `${widgetName}Props.d.ts`,
    );
    const typingContents = await generateTypesFromFile(
      originWidgetXmlPath,
      "web",
    );

    await fs.writeFile(newTypingsFilePath, typingContents);

    showMessage("Remove previous builds");

    const distDir = path.join(PROJECT_DIRECTORY, DIST_DIRECTORY_NAME);
    const distIsExists = await pathIsExists(distDir);

    if (distIsExists) {
      await fs.rm(distDir, {
        recursive: true,
        force: true,
      });
    }

    await fs.mkdir(distDir);

    showMessage("Copy resources");

    const widgetVersion = await getWidgetVersion();
    const outputDir = path.join(distDir, widgetVersion);

    await fs.mkdir(outputDir);
    await fs.mkdir(WEB_OUTPUT_DIRECTORY, {
      recursive: true,
    });

    const customViteConfigPath = path.join(
      PROJECT_DIRECTORY,
      VITE_CONFIGURATION_FILENAME,
    );
    const viteConfigIsExists = await pathIsExists(customViteConfigPath);
    let resultViteConfig: UserConfig;

    if (viteConfigIsExists) {
      const userConfig = await getViteUserConfiguration(customViteConfigPath);

      resultViteConfig = await getViteDefaultConfig(isProduction, userConfig);
    } else {
      resultViteConfig = await getViteDefaultConfig(isProduction);
    }

    const originPackageXmlPath = path.join(
      PROJECT_DIRECTORY,
      "src/package.xml",
    );
    const destPackageXmlPath = path.join(WEB_OUTPUT_DIRECTORY, "package.xml");
    const destWidgetXmlPath = path.join(
      WEB_OUTPUT_DIRECTORY,
      `${widgetName}.xml`,
    );

    await fs.copyFile(originPackageXmlPath, destPackageXmlPath);
    await fs.copyFile(originWidgetXmlPath, destWidgetXmlPath);

    showMessage("Start build");

    const designTimeViteConfigs =
      await getDesignTimeDefaultConfigs(isProduction);
    const viteBuildConfigs: InlineConfig[] = [
      {
        ...resultViteConfig,
        configFile: false,
        root: PROJECT_DIRECTORY,
      },
      ...designTimeViteConfigs.map(
        (config): InlineConfig => ({
          ...config,
          configFile: false,
          root: PROJECT_DIRECTORY,
          logLevel: "silent",
        }),
      ),
    ];

    await Promise.all(
      viteBuildConfigs.map(async (config) => {
        await viteBuild(config);
      }),
    );

    showMessage("Generate mpk file");

    const packageJson = await getWidgetPackageJson();
    const packageName = packageJson.packagePath;
    const mpkFileName = `${packageName}.${widgetName}.mpk`;
    const mpkFileDestPath = path.join(outputDir, mpkFileName);
    const mendixWidgetDirectory = await getMendixWidgetDirectory();
    const mendixMpkFileDestPath = path.join(mendixWidgetDirectory, mpkFileName);

    await zip(WEB_OUTPUT_DIRECTORY, mpkFileDestPath);
    await fs.copyFile(mpkFileDestPath, mendixMpkFileDestPath);

    showMessage(`${COLOR_GREEN("Build complete.")}`);
  } catch (error) {
    showMessage(
      `${COLOR_ERROR("Build failed.")}\nError occurred: ${COLOR_ERROR((error as Error).stack)}`,
    );
    process.exitCode = 1;
    throw error;
  }
};

export default buildWebCommand;
