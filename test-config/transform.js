module.exports = require("babel-jest").createTransformer({
  presets: [
    [require.resolve("@babel/preset-env"), { modules: "auto" }],
    require.resolve("@babel/preset-react"),
  ],
  plugins: [
    require.resolve("@babel/plugin-transform-class-properties"),
    require.resolve("@babel/plugin-transform-private-methods"),
    [
      require.resolve("@babel/plugin-transform-react-jsx"),
      { runtime: "automatic" },
    ],
  ],
});
