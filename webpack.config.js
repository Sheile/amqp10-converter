const path = require('path');
const webpack = require('webpack');
const TSConfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (env, args) => {
  const mode = args.mode ? args.mode : 'development';
  return {
    target: 'node',
    mode:  mode,
    entry: './src/index.ts',

    output: {
      path: path.join(__dirname, "build"),
      filename: "bundle.js"
    },

    module: {
      rules: [{
        test: /\.ts$/,
        use: 'ts-loader'
      }]
    },
    resolve: {
      modules: [
        "node_modules",
      ],
      extensions: [
        '.ts',
        '.js'
      ],
      plugins: [
        new TSConfigPathsPlugin({})
      ],
    },
    devtool: mode === 'development' ? 'source-map' : 'none',
  };
};
