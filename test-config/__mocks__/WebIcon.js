const React = require(
  require.resolve("react", {
    paths: [process.cwd(), require.resolve("@testing-library/react")],
  }),
);

module.exports = {
  Icon: () => React.createElement("img", { src: "mocked/web/icon" }),
};
