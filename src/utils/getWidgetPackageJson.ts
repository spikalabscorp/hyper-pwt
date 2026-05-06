import fs from "node:fs/promises";
import path from "node:path";

import { PROJECT_DIRECTORY } from "../constants";
import type { WidgetPackageJson } from "../types";

const getWidgetPackageJson = async (): Promise<WidgetPackageJson> => {
  try {
    const packageJsonPath = path.join(PROJECT_DIRECTORY, "package.json");
    const packageJsonFile = await fs.readFile(packageJsonPath, "utf-8");
    const packageJsonData: WidgetPackageJson = JSON.parse(packageJsonFile);

    return packageJsonData;
  } catch {
    throw new Error("package.json file is not exists.");
  }
};

export default getWidgetPackageJson;
