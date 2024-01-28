
module.exports = (env, options) => {
    const devMode = options.mode !== 'production';

return {
  entry: __dirname + "/mainWindow/mainwindow.tsx",
  output : {
    path : __dirname+"/../intermediate"
  },
  module: {
    rules: [{ test: /\.txt$/, use: 'raw-loader' }],
  },
  mode : "development"
}
};