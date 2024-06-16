// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25 <0.9.0;

import { ETHTransferProxy } from "../src/ETHTransferProxy.sol";
import { BaseScript } from "./Base.s.sol";

contract Deploy is BaseScript {
  function run() public broadcast returns (ETHTransferProxy e) {
    if (useCreate2) {
      e = new ETHTransferProxy{ salt: ZERO_SALT }(); // passing salt causes the ETHTransferProxy to be created at a deterministic address https://x.com/msolomon44/status/1613982126860554241
    } else {
      e = new ETHTransferProxy();
    }
  }
}
