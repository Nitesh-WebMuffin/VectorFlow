const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'vectorflow.umd.js',
    library: {
      name: 'VectorFlow',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
    clean: true,
  },
  devtool: 'source-map',
};
