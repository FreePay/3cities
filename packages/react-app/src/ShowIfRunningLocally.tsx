import React from "react";

export const ShowIfRunningLocally = () => { // display a visual indicator iff 3cities is running on a local development machine
  const h = window.location.hostname;
  if (h === "localhost" || h.startsWith("127.") || h.startsWith("192.")) return <div className="absolute z-50 top-0 left-0 bg-gray-400 text-white text-xs">LOCAL</div>;
  else return undefined;
}
