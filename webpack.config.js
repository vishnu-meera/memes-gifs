const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.jsx',
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
      clean: false,
      publicPath: '/',
    },
    resolve: {
      extensions: ['.js', '.jsx'],
      alias: {
        // Preact aliases for smaller bundle
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  modules: false,
                  targets: { browsers: ['>0.5%', 'not dead'] },
                  useBuiltIns: false,
                }],
              ],
              plugins: [
                ['@babel/plugin-transform-react-jsx', {
                  pragma: 'h',
                  pragmaFrag: 'Fragment',
                }],
              ],
              cacheDirectory: true,
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeAttributeQuotes: true,
        } : false,
        inject: 'body',
        scriptLoading: 'defer',
      }),
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: '[name].[contenthash:8].css',
        }),
      ] : []),
    ],
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              passes: 2,
            },
            mangle: true,
            output: { comments: false },
          },
          extractComments: false,
        }),
        new CssMinimizerPlugin(),
      ],
      // No chunk splitting - single bundle for faster cold start
      splitChunks: false,
      runtimeChunk: false,
    },
    devServer: {
      port: 3000,
      hot: true,
      historyApiFallback: true,
      compress: true,
    },
    devtool: isProduction ? false : 'eval-source-map',
    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 100000,
      maxEntrypointSize: 100000,
    },
  };
};
