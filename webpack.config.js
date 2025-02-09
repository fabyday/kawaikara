const path = require("path");
const { plugin } = require("typescript-eslint");
const Dotenv = require('dotenv-webpack');
const fg = require("fast-glob");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');

const { configDotenv } = require("dotenv");
const entry = fg.sync("./typescript_src/**/*.ts").reduce((entries, filePath) => {
  const entryName = filePath.replace("./typescript_src/", "").replace(".ts", "");
  entries[entryName] = filePath;
  return entries;
}, {});

configDotenv();

module.exports = [{
  entry: entry,
  target: "electron-main",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "public"),
    filename: "[name].js"
  },
  resolve: {
    extensions: [".js", ".ts"]
  },
  plugins : [
    new webpack.DefinePlugin({
        "DISCORD_APP_ID": JSON.stringify(process.env.DISCORD_APP_ID ),
        "DISCORD_APP_PUB_KEY": JSON.stringify(process.env.DISCORD_PUB_KEY)
      })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  }
},
{
  entry: "./typescript_src/component/predefine/communicate.ts",
  target: "electron-preload",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "public/component/predefine"),
    filename: "communicate.js"
  },
  resolve: {
    extensions: [".js", ".ts"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  }
},
{
target: 'electron-renderer' ,
mode : "production",
entry: {main : __dirname + "/react_src/mainWindow/mainwindow.tsx", 
  preference : __dirname + "/react_src/preferenceWindow/preference.tsx", 
  sidebar : __dirname+"/react_src/sidebar/sidebar.tsx"},
output : {
  path : __dirname+"/public/pages",
  filename : "[name].js",
  publicPath: '/'
},
resolve : {
  extensions: [".js", ".jsx", ".ts", ".tsx"],
  
},
module: {
  rules: [  
    { 
      test: /\.(ts|js)x?$/,
      exclude: "/node_modules/",
      // use: ["babel-loader", "ts-loader" ],
      use :{
        loader: "babel-loader",
        options: {
          presets: [
            "@babel/preset-env",
            "@babel/preset-react",
            "@babel/preset-typescript",
          ],
        },
      },
    }
  ],
},
plugins: [ new webpack.ProvidePlugin({
  React: "react",
}),
  new HtmlWebpackPlugin({
    template: './react_src/preferenceWindow/preference.html',
              minify: {
                  collapseWhitespace: true, // remove empty
                  removeComments: true, // remove comment
              } ,
              filename : "preference.html",
              chunks : ["preference"]
  }),
  
  new HtmlWebpackPlugin({
    template: './react_src/mainWindow/mainwindow.html',
              minify: {
                  collapseWhitespace: true, // remove empty
                  removeComments: true, // remove comment
              } ,
              filename : "main.html",
              chunks : ["main"]
  }),
  new HtmlWebpackPlugin({
    template: './react_src/sidebar/sidebar.html',
              minify:  {
                  collapseWhitespace: true, // remove empty
                  removeComments: true, // remove comment
              } ,
              filename : "sidebar.html",
              chunks : ["sidebar"]
  }),
  new CleanWebpackPlugin()

],
}
];
