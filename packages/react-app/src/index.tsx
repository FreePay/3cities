import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { enableMapSet } from "immer";
import "./index.css";

enableMapSet(); // see https://immerjs.github.io/immer/map-set https://immerjs.github.io/immer/installation#pick-your-immer-version

const root = createRoot((() => {
  const r = document.getElementById("root");
  if (r === null) throw new Error("couldn't find root element");
  return r;
})());

// NB as of React 18, when you use Strict Mode, React renders each component twice to help you find unexpected side effects. If you have React DevTools installed, the second log’s renders will be displayed in grey, and there will be an option (off by default) to suppress them completely
root.render(<React.StrictMode><App /></React.StrictMode>);
