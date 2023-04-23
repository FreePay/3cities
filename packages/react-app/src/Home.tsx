import React from "react";
import { About } from "./About";

export const Home: React.FC = () => {
  return <div>
    <div className="sm:hidden">
      <About />
    </div>
  </div>;
};
