import React from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

type Props = {
  children?: React.ReactNode
};

export const MainWrapper: React.FC<Props> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-500 to-blue-500 text-neutral-700">
      <Header />
      <div className="grow flex flex-col items-center justify-center p-5">
        {children}
      </div>
      <Footer />
    </div>
  );
};
