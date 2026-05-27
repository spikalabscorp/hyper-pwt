const path = require("path");

module.exports = {
  process(_src, filePath) {
    if (path.extname(filePath) !== ".svg") {
      return _src;
    }

    const name = `svg-${path.basename(filePath, ".svg")}`
      .split(/\W+/)
      .map((value) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`)
      .join("");

    return {
      code: `
const React = require(require.resolve("react", { paths: [process.cwd(), require.resolve("@testing-library/react")] }));
function ${name}(props) {
  return React.createElement(
    "svg",
    Object.assign({}, props, {"data-file-name": ${name}.name})
  );
}
module.exports = ${name};
`,
    };
  },
};
