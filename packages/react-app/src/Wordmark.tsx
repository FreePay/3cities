import React from "react";
import logo from "./images/logo.png";

export const Wordmark: React.FC = () => {
  return <div className="flex items-center">
    <img src={logo} className="mt-0.5 mr-0.25 w-8" alt="3cities logo" />
    <span className="text-2xl font-extrabold tracking-tight">
      3cities
    </span>
  </div>;
};
