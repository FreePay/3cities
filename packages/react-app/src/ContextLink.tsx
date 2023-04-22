import React from "react";
import { Outlet } from "react-router-dom";

export const ContextLink: React.FC = () => {
  return <div>
    <Outlet />
  </div>;
};
