import { mainnet, sepolia } from "./chains";
import { isProduction } from "./isProduction";

// ERC-1271
// isValidSignature(bytes32 hash, bytes signature) → bytes4 magicValue
export const erc1271SmartAccountAbi = [
  {
    name: 'isValidSignature',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes4' }],
  },
] as const;

export const erc1271MagicValue = "0x1626ba7e" as const;

export const caip222StyleSignatureMessageDomain = { // EIP-712 message domain
  name: '3cities',
  version: '1',
  // NB chainId is not needed for our message as we only want to prove sender address ownership (on any chain, assuming it then applies to all chains). Note that any chainId provided here is purely signed data and not actually used by any wallet to eg. switch to that chainId prior to signing
} as const;

export const caip222StyleSignatureMessageTypes = { // EIP-712 message types
  SenderAddress: [
    { name: 'senderAddress', type: 'address' },
  ],
} as const;

export const caip222StyleSignatureMessagePrimaryType = 'SenderAddress' as const; // EIP-712 message primaryType

export type Caip222StyleSignature = `0x${string}` | `eip1271-chainId-${number}`; // a successfully collected Caip222-style signature. `0x${string}` indicates an ordinary signature. `eip1271-chainId-${number}` indicates a smart contract wallet verified the message using eip1271 verification via a isValidSignature call on the provided chainId

export type Caip222StyleMessageToSign = {
  senderAddress: `0x${string}`;
};

export const chainIdOnWhichToSignMessagesAndVerifySignatures: number = isProduction ? mainnet.id : sepolia.id; // certain wallets generate different signatures depending on which chain is active at the time of message signing. To ensure that 3cities is later able to verify any generated signature, we only allow signature generation on a static sentinel chain (ie. the L1 in production). NB eip1271 onchain signatures are handled separately and use one of chains on which the eip1271 wallet exists
