import React from "react";
import { isProduction } from "./isProduction";

// buildInfo is a library that enables the app to include its own
// build info. For example, this can be used to double-check which
// build is actually being served on https://3cities.xyz, which you
// may want to do when deploying a new version to see if the IPFS DNS
// record has updated yet.

export const buildGitCommit: string | undefined = process.env['REACT_APP_GIT_COMMIT'] || undefined;
export const buildGitCommitDate: string | undefined = process.env['REACT_APP_GIT_COMMIT_DATE'] || undefined;
export const buildGitTag: string | undefined = process.env['REACT_APP_GIT_TAG'] || undefined;

export const BuildInfo: React.FC = () => {
  return <div className="mx-auto w-fit max-w-lg grid grid-cols-1 mt-8">
    <h1 className="text-xl">3cities build info</h1>
    <span>mainnet or testnet: {isProduction ? 'mainnet' : 'testnet'}</span>
    <span>{buildGitTag && `git tag: ${buildGitTag}`}</span>
    <span>{buildGitCommit && `git commit: ${buildGitCommit}`}</span>
    <span>{buildGitCommitDate && `git commit date: ${buildGitCommitDate}`}</span>
    <span>Time now: {(new Date()).toUTCString()}</span>
  </div>;
};
