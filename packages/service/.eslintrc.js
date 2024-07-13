// This package-specific .eslintrc.js file is automatically merged by `eslint` at runtime with our project's root .eslintrs.js https://eslint.org/docs/latest/use/configure/configuration-files#cascading-and-hierarchy
const path = require('path');

module.exports = {
    "env": {
        "es2022": true,
    },
    "parserOptions": {
        "project": path.resolve(__dirname, './tsconfig.json'),
    },
    "ignorePatterns": [
        "esbuild.mjs",
    ],
};
