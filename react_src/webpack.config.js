const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require("path");
const webpack = require('webpack');


module.exports = (env, options) => {
    const devMode = options.mode === 'production';

return {
  mode : devMode ? "production" : "development",
  entry: {app : __dirname + "/mainWindow/mainwindow.tsx", worker : __dirname + "/preferenceWindow/preference.tsx"},
  output : {
    path : __dirname+"/build",
    filename : "[name].js"
  },
  resolve : {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  devServer: {
    port: 3000,
    hot: true,
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
      template: './public/index.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "worker.html",
                chunks : ["worker"]
    }),
    
    new HtmlWebpackPlugin({
      template: './public/index.html',
                minify: process.env.NODE_ENV === 'production' ? {
                    collapseWhitespace: true, // remove empty
                    removeComments: true, // remove comment
                } : false,
                filename : "app.html",
                chunks : ["app"]
    }),
    new CleanWebpackPlugin()

  ],
  
}
};