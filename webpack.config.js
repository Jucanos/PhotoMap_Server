const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');
module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  devtool: 'source-map',
  externals: [nodeExternals()],
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
  module: {
    rules: [
      {
        test: /\\.js$/,
        loader: 'babel-loader',
        include: __dirname,
        exclude: /node_modules/,
      },
    ],
  },
};

// Version if the local Node.js version supports async/await
// webpack.config.js

// const webpack = require("webpack");
// const slsw = require("serverless-webpack");

// module.exports = (async () => {
//   const accountId = await slsw.lib.serverless.providers.aws.getAccountId();
//   return {
//     entry: slsw.lib.entries,
//     target: "node",
//     mode: slsw.lib.webpack.isLocal ? "development" : "production",
//     plugins: [
//       new webpack.DefinePlugin({
//         AWS_ACCOUNT_ID: `${accountId}`
//       })
//     ]
//   };
// })();
