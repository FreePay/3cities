// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25 <0.9.0;

import { Test } from "forge-std/src/Test.sol";
import { console2 } from "forge-std/src/console2.sol";

import { ETHTransferProxy } from "../src/ETHTransferProxy.sol";

// TODO tests
//   non-zero transfer
//     receiver balanced incremented
//     log emitted
//   zero transfer
//     receiver balanced unchanged
//     log emitted
//   failed transfer
