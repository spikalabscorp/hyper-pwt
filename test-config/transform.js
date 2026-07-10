module.exports = require("@swc/jest").createTransformer({
  jsc: {
    transform: { react: { runtime: "automatic" } },
    parser: { syntax: "ecmascript", jsx: true, decorators: true },
    target: "es2019",
  },
  module: { type: "commonjs" },
});
