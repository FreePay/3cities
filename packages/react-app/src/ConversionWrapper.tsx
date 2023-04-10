import React from "react";
import { Outlet } from "react-router-dom";
import { Footer } from "./Footer";
import { Header } from "./Header";


export const ConversionWrapper = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-500 to-blue-500 text-neutral-700">
      <Header />
      <div className="grow flex flex-col items-center justify-center p-5">
        <div>Conversion!</div>
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};
