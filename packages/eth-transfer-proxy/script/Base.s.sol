// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25 <0.9.0;

import { Script } from "forge-std/src/Script.sol";
import { console2 } from "forge-std/src/console2.sol";

abstract contract BaseScript is Script {
  string internal constant TEST_MNEMONIC = "test test test test test test test test test test test junk";

  bytes32 internal constant ZERO_SALT = bytes32(0); // convenience constant for clients to use as salt. By default in forge, passing salt to any constructor automatically causes the contract to be created at a deterministic address https://x.com/msolomon44/status/1613982126860554241

  address internal broadcaster; // the broadcast signer, derived from env PRIVATE_KEY, env ETH_FROM, or env MNEMONIC, in that priority order

  bool internal useCreate2 = true; // clients must use CREATE2 for deterministic deployment iff useCreate2

  constructor() {
    uint256 privKey = vm.envOr("PRIVATE_KEY", uint256(0));
    address ethFrom = vm.envOr({ name: "ETH_FROM", defaultValue: address(0) });
    string memory mnemonic = vm.envOr({ name: "MNEMONIC", defaultValue: TEST_MNEMONIC });
    if (privKey != 0) {
      broadcaster = vm.rememberKey(privKey);
      console2.log("broadcast signer set via PRIVATE_KEY");
    } else if (ethFrom != address(0)) {
      broadcaster = ethFrom;
      console2.log("broadcast signer set via ETH_FROM");
    } else if (bytes(mnemonic).length > 0) {
      (broadcaster,) = deriveRememberKey({ mnemonic: mnemonic, index: 0 });
      console2.log("broadcast signer set via MNEMONIC");
    } else {
      (broadcaster,) = deriveRememberKey({ mnemonic: TEST_MNEMONIC, index: 0 });
      console2.log("broadcast signer set via TEST_MNEMONIC");
    }
    if (bytes(chain()).length > 0) vm.createSelectFork(chain());
    if (bytes(vm.envOr("DISABLE_CREATE2", string.concat(""))).length > 0) useCreate2 = false;
  }

  function chain() internal view returns (string memory c) {
    c = vm.envOr("CHAIN", string.concat("")); // here string.concat is used as a type hint to prevent ambiguous overload compilation error
  }

  modifier broadcast() {
    vm.startBroadcast(broadcaster);
    _;
    vm.stopBroadcast();
  }
}
