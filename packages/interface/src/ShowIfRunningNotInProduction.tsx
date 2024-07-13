import { isProduction } from "@3cities/core";
import React from "react";

export const ShowIfRunningNotInProduction = () => { // display a visual indicator iff 3cities is running on a local development machine
  const labelParts = [];

  const h = window.location.hostname.toLowerCase();
  const isRunningLocally: boolean = h === "localhost" || h.startsWith("127.") || h.startsWith("192.");
  const isRunningInStaging: boolean = h === 'staging.3cities.xyz';
  const isRunningInProdTest: boolean = h === 'staging-prod.3cities.xyz';

  if (isRunningLocally) {
    labelParts.push('LOCAL');
    labelParts.push(isProduction ? "PROD" : "DEV");
  }
  if (isRunningInStaging) labelParts.push("TEST");
  if (isRunningInProdTest) labelParts.push("PROD-TEST");

  if (labelParts.length > 0) return <div className="absolute z-50 top-0 left-0 bg-gray-400 text-white text-xs">{labelParts.join(" ")}</div>;
  else return undefined;
}
