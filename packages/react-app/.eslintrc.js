// This package-specific .eslintrc.js file is automatically merged by `eslint` at runtime with our project's root .eslintrs.js https://eslint.org/docs/latest/use/configure/configuration-files#cascading-and-hierarchy
const path = require('path');

module.exports = {
    "settings": {
        "react": {
            "version": "detect",
        },
    },
    "env": {
        "browser": true,
        "es2021": true,
    },
    "extends": [
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
    ],
    "parserOptions": {
        "ecmaFeatures": {
            "jsx": true,
        },
        "project": path.resolve(__dirname, './tsconfig.json'),
    },
    "plugins": [
        "react",
    ],
    "ignorePatterns": [
        "tailwind.config.js",
        "postcss.config.js",
        "*.test.js",
    ],
    "rules": {
        "react-hooks/exhaustive-deps": [
            "warn",
            {
                "additionalHooks": "useEffectSkipFirst*",
            },
        ],
    },
};
