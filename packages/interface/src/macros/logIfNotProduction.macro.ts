// This file is an example macro to log to console when not in
// production, and for the log statemente to not exist in production.
// It allows you to do things like `$logIfNotProduction!('config
// loaded', config)` and have that macro expand to console.log('config
// loaded', config) or be removed entirely in production. However, for
// this to work, ts-macros needs compiler support, and the typescript
// compiler doesn't allow custom transformers. There are two
// recommended options: using a fork of the typescript compiler
// `ttypescript` that does support custom transformers, which I don't
// want to do; or supporting a TsMacro transformer as part of the
// compiler process, which I couldn't figure out how to make work with
// create-react-app.
// TODO see if I can get ts-macros working after we switch to Vite.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck TODO once the ts-macro transformer is correctly being run, this file may typecheck normally and @ts-nocheck might be able to be removed
import createMacro from 'ts-macros';

export const $logIfNotProduction = createMacro(logIfNotProductionImpl);

function logIfNotProductionImpl({ references, babel }) {
  const isProduction: boolean = process.env['REACT_APP_IS_PRODUCTION'] === 'true'; // WARNING this boolean definition has been copied from isProduction.ts because we're unable to import a non-macro module from inside a macro module (as the non-macro module doesn't exist yet)
  if (!isProduction) {
    const { types: t } = babel;
    references.default.forEach(referencePath => {
      if (t.isCallExpression(referencePath.parent)) {
        referencePath.parentPath.replaceWith(
          t.expressionStatement(
            t.callExpression(
              t.memberExpression(t.identifier('console'),
                t.identifier('log')),
              [...referencePath.parent.arguments],
            )
          )
        );
      }
    });
  }
}
