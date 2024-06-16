
# Overview

ETHTransferProxy is a stateless hyperstructure that provides ERC20-compliant Transfer events for ETH transfers.

ETHTransferProxy exists because generalized offchain detection of ETH transfers (eg. when using smart contract wallets) cannot be done using the ethrpc api, and can only be done with non-standard tracing APIs.

Clients may route ETH transfers through ETHTransferProxy such that the ETH transfer is detectable by monitoring for Transfer events.

A permament solution to this problem has been proposed via EIP-7708: ETH transfers emit a log.

# Canonical deployments

ETHTransferProxy is a stateless hyperstructure that may be used permissionlessly and has been deployed on a variety of mainnet and testnet chains.

See `ETHTransferProxyContractAddresses`.

# Usage

eth-transfer-proxy provides convenient facilities to interact with canonical deployments of ETHTransferProxy.

In a TypeScript client:

```typescript
// First, import the convenient facilities:
import { ETHTransferProxyABI, getETHTransferProxyContractAddress } from '@3cities/eth-transfer-proxy'; // yarn add @3cities/eth-transfer-proxy"

// Second, use them in your code to send transactions to canonical deployments of ETHTransferProxy. For example, use the abitype and/or wagmi libraries:

// abitype example:
import { ExtractAbiEvent } from "abitype"; // yarn add abitype
type ETHTransferEvent = ExtractAbiEvent<typeof ETHTransferProxyABI, 'Transfer'>

// wagmi example:
import { prepareContractWrite } from "wagmi"; // yarn add wagmi
const ethTransferProxyContractAddress = getETHTransferProxyContractAddress(chainId);
const receiverAddress = "0x123" ; // Ethereum address of ETH transfer receiver
const ethTransferAmount = 1000000000000000000n // 1 ETH in wei
const result = prepareContractWrite(ethTransferProxyContractAddress ? {
  chainId,
  address: ethTransferProxyContractAddress,
  abi: ETHTransferProxyABI,
  functionName: 'transferETH',
  args: [receiverAddress],
  overrides: {
    value: ethTransferAmount,
  },
} as const : {
  enabled: false,
});
// ... handle result
```

# zkSync Era Support

1. foundry does not support zkSync out of the box. A fork of foundry is in development which we do not use https://github.com/matter-labs/foundry-zksync
2. ETHTransferProxy was manually deployed to zkSync Era Sepolia and zkSync Era using Atlas IDE https://docs.zksync.io/build/quick-start/deploy-your-first-contract
