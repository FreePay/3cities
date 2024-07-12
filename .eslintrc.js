// TODO disallow `as` keyword
// TODO merge that branch with more typesafe eslint rules
const path = require('path');
const rulesDirPlugin = require('eslint-plugin-rulesdir');
rulesDirPlugin.RULES_DIR = [path.resolve(__dirname, 'eslint-rules')];

module.exports = {
    "root": true,
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
    },
    "plugins": [
        "@typescript-eslint",
        'rulesdir',
    ],
    "ignorePatterns": [
        ".eslintrc.js",
        "eslint-rules/",
        "node_modules/",
        "build/",
        "dist/",
    ],
    "rules": {
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-non-null-assertion": [
            "error",
        ],
        "eqeqeq": [
            "error",
        ],
        "new-cap": [
            "error",
        ],
        "no-restricted-imports": [
            "error",
            {
                "paths": [
                    {
                        "name": "@lingui/macro",
                        "importNames": [
                            "t"
                        ],
                        "message": "Please use <Trans> instead of t."
                    },
                    {
                        "name": "wagmi/chains",
                        "message": "Import from 3cities './chains' instead."
                    },
                    {
                        "name": "viem/chains",
                        "message": "Import from 3cities './chains' instead."
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
        "no-shadow": [
            "error",
        ],
        "no-unreachable": [
            "error",
        ],
        "no-unused-expressions": [
            "error",
        ],
        "rulesdir/no-instanceof-ChainMismatchError": [
            "warn",
        ],
        "rulesdir/no-conditional-returns": [
            "warn",
        ],
        "rulesdir/no-use-below": [
            "error",
        ],
    },
};
