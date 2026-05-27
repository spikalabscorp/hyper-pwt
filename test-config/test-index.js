const { createRequire } = require("module");
const requireFromConfig = createRequire(__filename);

const { TextDecoder, TextEncoder } = require("util");

requireFromConfig("@testing-library/jest-dom");

Object.defineProperties(global, {
  TextEncoder: {
    value: TextEncoder,
  },
  TextDecoder: {
    value: TextDecoder,
  },
});
