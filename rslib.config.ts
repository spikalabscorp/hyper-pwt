import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "cjs",
      bundle: true,
      dts: true,
      source: {
        entry: {
          cli: "src/cli.ts",
        },
      },
      output: {
        filename: {
          js: "[name].cjs",
        },
      },
    },
    {
      format: "esm",
      bundle: true,
      dts: true,
      source: {
        entry: {
          index: "src/index.ts",
        },
      },
      output: {
        filename: {
          js: "[name].mjs",
        },
      },
    },
    {
      format: "cjs",
      bundle: true,
      dts: false,
      source: {
        entry: {
          index: "src/index.ts",
        },
      },
      output: {
        filename: {
          js: "[name].cjs",
        },
      },
    },
  ],
  output: {
    minify: {
      js: true,
      jsOptions: {
        minimizerOptions: {
          mangle: true,
          minify: true,
          compress: {
            defaults: true,
            unused: true,
            dead_code: true,
            toplevel: true,
          },
        },
      },
    },
  },
});
