module.exports = {
  create: function (context) {
    // Helper functions to check if a given node returns or throws unconditionally
    function returnsUnconditionally(node) {
      if (node.type === 'ReturnStatement') {
        return true;
      }
      if (node.type === 'BlockStatement') {
        return node.body.some(returnsUnconditionally);
      }
      if (node.type === 'IfStatement') {
        return returnsOrThrowsUnconditionally(node);
      }
      return false;
    }

    function returnsOrThrowsUnconditionally(node) {
      if (node.type === 'ThrowStatement') {
        return true;
      }
      if (node.type === 'IfStatement') {
        const ifReturnsOrThrows = returnsOrThrowsUnconditionally(node.consequent);
        const elseReturnsOrThrows = node.alternate && returnsOrThrowsUnconditionally(node.alternate);
        return ifReturnsOrThrows && (elseReturnsOrThrows || node.alternate === null);
      }
      return returnsUnconditionally(node);
    }

    // Check for unconditional returns or throws in conditionals
    function checkConditional(node) {
      const hasReturnInIfBlock = returnsUnconditionally(node.consequent);
      const hasReturnOrThrowInElseBlock = node.alternate && returnsOrThrowsUnconditionally(node.alternate);

      // Check if all branches return or throw unconditionally
      const allBranchesReturnOrThrow = (currentNode) =>
        returnsOrThrowsUnconditionally(currentNode.consequent) &&
        (!currentNode.alternate ||
          returnsOrThrowsUnconditionally(currentNode.alternate) ||
          (currentNode.alternate.type === 'IfStatement' &&
            allBranchesReturnOrThrow(currentNode.alternate)));

      // Require an else branch when the if block returns unconditionally
      if (hasReturnInIfBlock && !node.alternate) {
        context.report({
          node: node.consequent,
          message: 'Expected an "else" branch to return or throw when the "if" block returns.',
        });
      } else if (hasReturnInIfBlock && !hasReturnOrThrowInElseBlock && !allBranchesReturnOrThrow(node)) {
        context.report({
          node: node,
          message: 'Expected all branches of the conditional to return or throw when any branch returns.',
        });
      }
    }

    return {
      IfStatement: checkConditional,
    };
  },
};
