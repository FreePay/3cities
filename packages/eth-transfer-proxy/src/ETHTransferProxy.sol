// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

// ETHTransferProxy is a stateless hyperstructure that provides
// ERC20-compliant Transfer events for ETH transfers. ETHTransferProxy
// exists because generalized offchain detection of ETH transfers (eg.
// when using smart contract wallets) cannot be done using the ethrpc
// api, and can only be done with non-standard tracing APIs. Clients may
// route ETH transfers through ETHTransferProxy such that the ETH
// transfer is detectable by monitoring for Transfer events. A permament
// solution to this problem has been proposed via EIP-7708: ETH
// transfers emit a log.
contract ETHTransferProxy {
  error ETHTransferFailed();

  event Transfer(address indexed from, address indexed to, uint256 value); // identical to ERC20.Transfer

  // transferETH transfers the received ETH to the passed receiver and
  // emits an ERC20-compliant Transfer event.
  function transferETH(address payable receiver) external payable {
    (bool success,) = receiver.call{ value: msg.value }("");
    if (!success) revert ETHTransferFailed();
    emit Transfer(msg.sender, receiver, msg.value);
  }
}
