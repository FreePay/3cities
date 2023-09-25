// The no-use-below[varName] eslint rule allows the user to specify that
// a specific variable may not be reused (ie. referenced again) in the
// same scope below the rule definition. In almost every case, this rule
// shouldn't be needed and isn't appropriate, as we can instead use eg.
// better problem decomposition with smaller functions, fewer local
// variables, and less code per function, and/or IEFE (immediately
// evaluated function expressions) if there are temporary/intermediate
// variables that should be excluded from the main scope. However, in
// some rare cases, (i) variables must be defined in the main scope and
// can't be isolated in IEFEs, (ii) the scope/function is large and
// complex, and (iii) those variables are unsafe to be be reused below a
// certain point in the scope, in which case this rule can help ensure
// those variables are in fact not used below that point in the scope.
// An example of a rare case is that while React hooks must be called
// unconditionally, we may want to conditionally use hook results to
// compute new local variables that then provide an "hook conditionality
// abstraction boundary" to the rest of the function, such that the rest
// of the function doesn't have to care about the raw hook results or
// conditional state driving those raw results. Another example of a
// rare case is when a global variable is being used for a singleton
// inflight promise, and we don't want the variable to be used except in
// the promise/singleton handlers.
module.exports = {
  create: function (context) {
    function extractVariableNameFromComment(comment) {
      const match = comment.value.match(/@eslint-no-use-below\[(\w+)\]/);
      return match ? match[1] : null;
    }

    function getAllIdentifiersWithVariableName(node, variableName, references) {
      if (node.type === 'Identifier' && node.name === variableName) {
        references.push(node);
      }

      for (const key in node) { // recursively traverse child nodes
        if (key === 'parent') continue; // traverse only down the AST and not back up (which would cause infinite recursion and isn't needed as we've already processed parents if relevant)
        else if (node.hasOwnProperty(key) && typeof node[key] === 'object' && node[key] !== null) {
          if (Array.isArray(node[key])) {
            node[key].forEach(childNode => getAllIdentifiersWithVariableName(childNode, variableName, references));
          } else {
            getAllIdentifiersWithVariableName(node[key], variableName, references);
          }
        }
      }
    }

    function findReferencesInFunction(variableName, node) {
      const references = [];
      getAllIdentifiersWithVariableName(node, variableName, references);
      return references;
    }

    function handleFunctionNode(isGlobalMode, node) {
      const sourceCode = context.getSourceCode();
      const comments = sourceCode.getCommentsInside(node);

      for (const comment of comments) {
        if (comment.value.includes("@eslint-no-use-below")) {
          const variableName = extractVariableNameFromComment(comment);
          if (variableName) {
            const isCommentInGlobalScope = (() => {
              const l = sourceCode.lines[comment.loc.start.line - 1];
              return l.trimStart() === l; // here we define a comment as being in the global scope if its line of code doesn't begin with whitespace. eslint doesn't seem to provide facilities to easily and robustly construct the predicate `isInTheGlobalScope(comment)`, so we approximate it by observing that lines of code aren't usually indented in the global scope. This approximation should have no false positives, since lines of code are always indented in non-global scopes, but it it may produce false negatives in that occassionally, some lines of code are indented in the global scope (such as a long expression that wraps to the next line). Users are responsible for ensuring their @eslint-no-use-below directives in the global scope are put on lines of code that aren't indented.
            })();
            if (!isGlobalMode || (isGlobalMode && isCommentInGlobalScope)) { // here, if this rule is being executed in global mode (which is only if the passed node is the entire Program), we then skip processing rule instances that aren't the global scope, as they will be processed by other rule runners for non-global scopes. If we instead we, during global mode, processed rule instances that aren't in the global scope, then a few undesirable things happen: (i) rule violations in functions will be double-reported because they are detected by both the function-specific runner as well as the global runner, (ii) rule instances are no longer properly scoped to functions because the global Program runner finds all comments and all identifiers in the whole program (instead of just locally in a passed function node), and so eg. if a function has a local variable `tmp` and we use @eslint-no-reuse[tmp], and then another function further down has another local `tmp`, the 2nd function will report a rule violation based on the 1st function's rule, which is not correct because rule instances functions should be isolated to those functions and their inner scopes, (iii) the Program runner will parse the AST for all functions in the program for every rule instance (noting that in our config, Program runners are isolated to es6 modules, so it only parses AST for an entire module), which is inefficient given the function-specific runners already do this. --> if we instead tried to drop global mode and only have function-specific runners, then @eslint-no-use-below won't work for global variables, but we want it to work everywhere, so that's why we do this strategy.
              const illegalReferences = findReferencesInFunction(variableName, node).filter(ref => ref.loc.start.line > comment.loc.end.line);
              if (illegalReferences.length > 0) {
                illegalReferences.forEach(ref => {
                  context.report({
                    loc: ref.loc,
                    message: `'${variableName}' is not allowed to be used after the '@eslint-no-use-below[${variableName}]' rule in the same scope or any inner scopes.`
                  });
                });
              }
            }
          } else {
            // rule was used with improper syntax
            context.report({
              loc: comment.loc,
              message: `Syntax error in rule: it should match '@eslint-no-use-below[varName]'.`
            });
          }
        }
      }
    }

    return {
      FunctionDeclaration: handleFunctionNode.bind(null, false),
      FunctionExpression: handleFunctionNode.bind(null, false),
      ArrowFunctionExpression: handleFunctionNode.bind(null, false),
      ClassDeclaration: handleFunctionNode.bind(null, false),
      ClassExpression: handleFunctionNode.bind(null, false),
      Program: handleFunctionNode.bind(null, true),
    };
  }
};
