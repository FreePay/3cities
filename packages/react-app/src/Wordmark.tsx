import React from "react";
import logo from "./images/logo.png";

export const Wordmark: React.FC = React.memo(() => {
  return <div className="flex items-center justify-center">
    <img src={logo} className="mt-0.5 mr-1 w-8" alt="3cities logo" />
    <span className="text-2xl font-extrabold tracking-tight text-black">
      3cities
    </span>
  </div>;
});

Wordmark.displayName = "Wordmark";
