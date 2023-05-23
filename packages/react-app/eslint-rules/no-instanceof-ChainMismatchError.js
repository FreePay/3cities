module.exports = {
  create: function (context) {
    return {
      BinaryExpression(node) {
        if (
          node.operator === "instanceof" &&
          node.right.type === "Identifier" &&
          node.right.name === "ChainMismatchError"
        ) {
          context.report({
            node,
            message: 'use isChainMismatchError instead of the unsafe "instanceof ChainMismatchError"',
          });
        }
      },
    };
  },
};
