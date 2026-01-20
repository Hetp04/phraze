const path = require('path');

module.exports = {
  entry: './content.js', // The entry point for your content script
  output: {
    filename: 'content.bundle.js', // The name of the bundled output file
    path: path.resolve(__dirname, 'dist'), // The folder where the bundled file will be saved
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Apply Babel transpilation to .js files
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  mode: 'production', // Use production mode for optimized output
};
