
// TODO support switch fallthrough cases

// NB see noConditionalReturnsTestCases.ts

// This no-conditional-returns eslint rule ensures that if any branch of an
// if-statement or try/catch might return, then the whole statement always
// returns or throws, and control flow never continues in the same
// function. The benefit here is that if you're looking at any code, you
// know control flow has always reached this spot and don't have to worry
// about the function having returned early, which can be a major source of
// bugs.
module.exports = {
  create: function (context) {
    function hasAnyReturn(node) {
      if (node.type === 'ReturnStatement') {
        return true;
      } else if (node.type === 'BlockStatement') {
        return node.body.some(hasAnyReturn);
      } else if (node.type === 'IfStatement') {
        const ifHasReturn = hasAnyReturn(node.consequent);
        const elseHasReturn = node.alternate && hasAnyReturn(node.alternate);
        return ifHasReturn || elseHasReturn;
      } else if (node.type === 'SwitchStatement') {
        return node.cases.some((caseNode) => caseNode.consequent.some(hasAnyReturn));
      } else if (node.type === 'SwitchCase') {
        return node.consequent.some(hasAnyReturn);
      } else if (node.type === 'TryStatement') {
        const blockHasReturn = hasAnyReturn(node.block);
        const handlerHasReturn = node.handler && hasAnyReturn(node.handler.body);
        return blockHasReturn || handlerHasReturn;
      } else {
        return false;
      }
    }

    function returnsOrThrowsUnconditionally(node) {
      if (node.type === 'ReturnStatement' || node.type === 'ThrowStatement') {
        return true;
      } else if (node.type === 'BlockStatement') {
        return node.body.some(returnsOrThrowsUnconditionally);
      } else if (node.type === 'IfStatement') {
        const ifReturnsOrThrows = returnsOrThrowsUnconditionally(node.consequent);
        const elseReturnsOrThrows = node.alternate && returnsOrThrowsUnconditionally(node.alternate);
        return ifReturnsOrThrows && (elseReturnsOrThrows || node.alternate === null);
      } else if (node.type === 'SwitchStatement') {
        return node.cases.every((caseNode) => caseNode.consequent.some(returnsOrThrowsUnconditionally));
      } else if (node.type === 'SwitchCase') {
        return node.consequent.some(returnsOrThrowsUnconditionally);
      } else if (node.type === 'TryStatement') {
        const blockReturnsOrThrows = returnsOrThrowsUnconditionally(node.block);
        const handlerReturnsOrThrows = node.handler && returnsOrThrowsUnconditionally(node.handler.body);
        return blockReturnsOrThrows && handlerReturnsOrThrows;
      } else return false;
    }

    function checkConditional(ifStatement) {
      const consequentHasAnyReturn = hasAnyReturn(ifStatement.consequent);
      const alternateExistsAndHasAnyReturn = ifStatement.alternate && hasAnyReturn(ifStatement.alternate);

      const consequentReturnsOrThrowsUnconditionally = returnsOrThrowsUnconditionally(ifStatement.consequent);
      const alternateExistsAndReturnsOrThrowsUnconditionally = ifStatement.alternate && returnsOrThrowsUnconditionally(ifStatement.alternate);

      if (consequentHasAnyReturn && !ifStatement.alternate) {
        context.report({
          node: ifStatement,
          message: 'Expected an "else" branch to exist and unconditionally return or throw when the "if" block has any return.',
        });
      } else if (consequentHasAnyReturn && !alternateExistsAndReturnsOrThrowsUnconditionally) {
        context.report({
          node: ifStatement,
          message: 'Expected the "else" branch to unconditionally return or throw when the "if" block has any return.',
        });
      } else if (alternateExistsAndHasAnyReturn && !consequentReturnsOrThrowsUnconditionally) {
        context.report({
          node: ifStatement,
          message: 'Expected the "if" branch to unconditionally return or throw when the "else" block has any return.',
        });
      }
    }

    function checkSwitchStatement(switchStatement) {
      if (switchStatement.cases.length < 1) return;

      const anyCaseHasAnyReturn = switchStatement.cases.some(caseNode => hasAnyReturn(caseNode));
      const allCasesReturnOrThrowUnconditionally = switchStatement.cases.every(caseNode => returnsOrThrowsUnconditionally(caseNode));

      if (anyCaseHasAnyReturn && !allCasesReturnOrThrowUnconditionally) {
        context.report({
          node: switchStatement,
          message: 'Expected all cases in the "switch" statement to unconditionally return or throw when any case has a return.',
        });
      }
    }

    function checkTryCatch(tryStatement) {
      const blockHasAnyReturn = hasAnyReturn(tryStatement.block);
      const handlerExistsAndHasAnyReturn = tryStatement.handler && hasAnyReturn(tryStatement.handler.body);

      const blockReturnsOrThrowsUnconditionally = returnsOrThrowsUnconditionally(tryStatement.block);
      const handlerExistsAndReturnsOrThrowsUnconditionally = tryStatement.handler && returnsOrThrowsUnconditionally(tryStatement.handler.body);

      if (blockHasAnyReturn && !handlerExistsAndReturnsOrThrowsUnconditionally) {
        context.report({
          node: tryStatement,
          message: 'Expected the "catch" branch to unconditionally return or throw when the "try" block has any return.',
        });
      } else if (handlerExistsAndHasAnyReturn && !blockReturnsOrThrowsUnconditionally) {
        context.report({
          node: tryStatement,
          message: 'Expected the "try" branch to unconditionally return or throw when the "catch" block has any return.',
        });
      }
    }

    return {
      IfStatement: checkConditional,
      SwitchStatement: checkSwitchStatement,
      TryStatement: checkTryCatch,
    };
  },
};
