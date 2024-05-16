// explicit-return-type-on-certain-functions is a rule that enforces that anonymous functions passed to an allowlist of functions must have the anonymous function's return type included in the signature.

const functionsForWhichToApplyThisRule = [
  'useMemo',
  'useCallback',
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "enforce explicit return types on function literals passed to certain functions",
      category: "TypeScript Practices",
      recommended: true,
    },
    schema: [], // TODO consider making functionsForWhichToApplyThisRule configurable through the rule's options in the schema
  },
  create: function (context) {
    return {
      CallExpression(node) {
        let functionName = node.callee.name;
        if (node.callee.type === 'MemberExpression' && node.callee.property) { // check for namespaced function call like React.useMemo. TODO if we ever need to handle more deeply nested properties (eg. bar.foo.useMemo), consider a recursive approach or parsing the node.callee fully.
          functionName = node.callee.property.name;
        }

        if (functionsForWhichToApplyThisRule.includes(functionName) && node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg.type === 'ArrowFunctionExpression' && !firstArg.returnType) {
            context.report({
              node: firstArg,
              message: `Missing explicit return type on function literal for ${functionName}.`
            });
          }
        }
      }

    };
  }
};
