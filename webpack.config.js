const path = require("path")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: path.resolve(__dirname, "src/index.ts"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name]-[fullhash].js",
    clean: true
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".json"],
  },
  devtool: false,
  devServer: {
    // hot: false,
    injectClient: false,
  },
  module: {
    rules: [
      {
        test: /\.ts(x)?$/,
        loader: "ts-loader",
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      }
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name]-[fullhash].css"
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "index.html"),
    })
  ]
}
