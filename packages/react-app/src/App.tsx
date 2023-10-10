import React from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./Routes";

const loadingPlaceholderInnerHtml: string = (() => {
  const p = process.env['REACT_APP_LOADING_PLACEHOLDER_INNER_HTML'];
  if (p === undefined || p.length < 1) throw new Error(`expected REACT_APP_LOADING_PLACEHOLDER_INNER_HTML to be defined`);
  else return p;
})();

const LoadingPlaceholder = () => <div dangerouslySetInnerHTML={{ __html: loadingPlaceholderInnerHtml }} />;

export const App = () => <RouterProvider router={router} fallbackElement={<LoadingPlaceholder />} />;
