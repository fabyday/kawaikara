const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const { loadLocalEnvironment } = require('./scripts/lib/env.cjs');

const root = __dirname;
loadLocalEnvironment(root);
const RELEASE_CHANNELS = ['stable', 'staging', 'nightly'];

function resolveBuildChannel() {
  const channel = process.env.KAWAIKARA_BUILD_CHANNEL || 'nightly';
  if (!RELEASE_CHANNELS.includes(channel)) {
    throw new Error(`Unknown KAWAIKARA_BUILD_CHANNEL: ${channel}`);
  }
  return channel;
}

const typescriptRule = {
  test: /\.tsx?$/,
  exclude: /node_modules/,
  use: {
    loader: 'ts-loader',
    options: {
      configFile: path.join(root, 'tsconfig.json'),
      transpileOnly: true,
    },
  },
};

function createCommon(mode) {
  return {
  mode,
  devtool: mode === 'development' ? 'source-map' : false,
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  module: {
    rules: [typescriptRule],
  },
  };
};

module.exports = (_environment, arguments_) => {
  const mode = arguments_.mode || process.env.NODE_ENV || 'production';
  const common = createCommon(mode);
  const buildChannel = resolveBuildChannel();
  const buildDefinitions = new webpack.DefinePlugin({
    __KAWAIKARA_BUILD_CHANNEL__: JSON.stringify(buildChannel),
    __KAWAIKARA_DISCORD_APP_ID__: JSON.stringify(
      process.env.DISCORD_APP_ID || '',
    ),
  });

  return [
  {
    ...common,
    name: 'main',
    target: 'electron-main',
    entry: path.join(root, 'src/Main/Main.ts'),
    output: {
      path: path.join(root, 'dist/main'),
      filename: 'main.js',
      clean: true,
    },
    externals: {
      electron: 'commonjs2 electron',
      patchright: 'commonjs2 patchright',
      'discord-rpc': 'commonjs2 discord-rpc',
      'electron-log/main': 'commonjs2 electron-log/main',
      'electron-updater': 'commonjs2 electron-updater',
    },
    plugins: [buildDefinitions],
  },
  {
    ...common,
    name: 'preload',
    target: 'electron-preload',
    entry: {
      preload: path.join(root, 'src/Preload/Preload.ts'),
      viewer: path.join(root, 'src/Preload/ViewerPreload.ts'),
    },
    output: {
      path: path.join(root, 'dist/preload'),
      filename: '[name].js',
      clean: true,
    },
    externals: {
      electron: 'commonjs2 electron',
    },
  },
  {
    ...common,
    name: 'renderer',
    target: 'electron-renderer',
    entry: {
      overlay: path.join(root, 'src/Renderer/View/Overlay/Index.tsx'),
      video: path.join(root, 'src/Renderer/View/Video/Index.tsx'),
      'external-login': path.join(
        root,
        'src/Renderer/View/ExternalLogin/Index.tsx',
      ),
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      alias: {
        react: path.dirname(require.resolve('react/package.json')),
        'react-dom': path.dirname(require.resolve('react-dom/package.json')),
        motion: path.dirname(require.resolve('motion/package.json')),
      },
    },
    output: {
      path: path.join(root, 'dist/renderer'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        typescriptRule,
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|webp|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name].[contenthash:8][ext]',
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(root, 'src/Renderer/View/Overlay/Index.html'),
        filename: 'index.html',
        chunks: ['overlay'],
      }),
      new HtmlWebpackPlugin({
        template: path.join(root, 'src/Renderer/View/Video/Index.html'),
        filename: 'video.html',
        chunks: ['video'],
      }),
      new HtmlWebpackPlugin({
        template: path.join(
          root,
          'src/Renderer/View/ExternalLogin/Index.html',
        ),
        filename: 'external-login.html',
        chunks: ['external-login'],
      }),
    ],
  },
  ];
};
