import pkg from "../package.json";

// buildInfo is a library that enables the app to include its own
// build info. For example, this can be used to double-check which
// build is actually being served on https://3cities.xyz, which you
// may want to do when deploying a new version to see if the IPFS DNS
// record has updated yet.

export const buildPackageJsonVersion: string = pkg.version;
export const buildGitCommit: string = process.env['REACT_APP_GIT_COMMIT'] || '';
export const buildGitCommitDate: string = process.env['REACT_APP_GIT_COMMIT_DATE'] || '';
export const buildGitTag: string = process.env['REACT_APP_GIT_TAG'] || '';
