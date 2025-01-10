module.exports = {
    preset: 'ts-jest', //typescript-jest preset
    testEnvironment: 'node', // Electron main process test env.
    moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
    testPathIgnorePatterns: ['/node_modules/'],
    globals: {
      'ts-jest': {
        tsconfig: 'tsconfig.json', 
      },
    },
  };