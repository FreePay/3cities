const path = require('path');
const rulesDirPlugin = require('eslint-plugin-rulesdir');
rulesDirPlugin.RULES_DIR = [path.resolve(__dirname, 'eslint-rules')];

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
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaFeatures": {
            "jsx": true,
        },
        "ecmaVersion": "latest",
        "sourceType": "module",
    },
    "plugins": [
        "react",
        "@typescript-eslint",
        'rulesdir',
    ],
    "ignorePatterns": [
        ".eslintrc.js",
        "tailwind.config.js",
        "postcss.config.js",
        "*.test.js",
        "eslint-rules/",
        "node_modules/",
        "build/",
    ],
    "rules": {
        "rulesdir/no-conditional-returns": [
            "warn",
        ],
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "react-hooks/exhaustive-deps": [
            "warn",
            {
                "additionalHooks": "useEffectSkipFirst*",
            },
        ],
        "no-restricted-imports": [
            "error",
            {
                "paths": [
                    {
                        "name": "ethers",
                        "message": "Please import from '@ethersproject/module' directly to support tree-shaking."
                    },
                    {
                        "name": "@lingui/macro",
                        "importNames": [
                            "t"
                        ],
                        "message": "Please use <Trans> instead of t."
                    },
                ],
                "patterns": [
                    {
                        "group": [
                            "**/dist"
                        ],
                        "message": "Do not import from dist/ - this is an implementation detail, and breaks tree-shaking."
                    },
                ],
            },
        ],
    },
};
