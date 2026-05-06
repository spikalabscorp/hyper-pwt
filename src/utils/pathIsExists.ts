import fs from "node:fs/promises";

const pathIsExists = async (directoryPath: string): Promise<boolean> => {
  try {
    await fs.access(directoryPath, fs.constants.F_OK);

    return true;
  } catch {
    return false;
  }
};

export default pathIsExists;
