const { join } = require("path");

const projectDir = process.cwd();

module.exports = {
  clearMocks: true,
  testRunner: require.resolve("jest-jasmine2"),
  rootDir: join(projectDir, "src"),
  setupFilesAfterEnv: [join(__dirname, "test-index.js")],
  testMatch: ["<rootDir>/**/*.spec.{js,jsx,ts,tsx}"],
  transform: {
    "^.+\\.tsx?$": [
      require.resolve("ts-jest"),
      {
        tsconfig: { module: "commonjs", target: "ES2019" },
      },
    ],
    "^.+\\.jsx?$": join(__dirname, "transform.js"),
    "^.+\\.svg$": join(__dirname, "jest-svg-transformer.js"),
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": require.resolve("identity-obj-proxy"),
    "mendix/components/web/Icon": join(__dirname, "__mocks__/WebIcon.js"),
    "mendix/filters/builders": join(__dirname, "__mocks__/FilterBuilders.js"),
    "\\.png$": join(__dirname, "assetsTransformer.js"),
    "react-hot-loader/root": join(__dirname, "__mocks__/hot.js"),
  },
  moduleDirectories: ["node_modules", join(projectDir, "node_modules")],
  modulePaths: [join(__dirname, "../node_modules")],
  collectCoverage: !process.env.CI,
  coverageDirectory: join(projectDir, "dist/coverage"),
  testEnvironment: require.resolve("jest-environment-jsdom"),
};
