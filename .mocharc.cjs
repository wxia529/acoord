export default {
  require: ['ts-node/register'],
  extension: ['ts'],
  spec: 'src/test/unit/**/*.test.ts',
  timeout: 5000,
  loader: 'ts-node/esm',
  loaderOptions: {
    esm: {
      experimentalSpecifierResolution: 'node'
    },
    compilerOptions: {
      module: 'Node16'
    }
  }
};