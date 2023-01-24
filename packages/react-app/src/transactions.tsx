import { abis } from "@3cities/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { TransactionReceipt } from "@ethersproject/providers";
import { Token, TransactionStatus, useContractFunction, useEthers } from "@usedapp/core";
import React from "react";
import { switchNetwork } from "./switchNetwork";
import { isToken } from "./tokens";
import { TokenTransfer } from "./tokenTransfer";
import { allChainIds } from "./usedappConfig";

type ExecuteTokenTransferButtonProps = {
  tt: TokenTransfer;
}

export const ExecuteTokenTransferButton: React.FC<ExecuteTokenTransferButtonProps> = ({ tt }) => {
  const token = tt.token;
  return isToken(token) ? <ExecuteTokenTransferButtonInternal tt={Object.assign({}, tt, { token })} /> : <span></span>;
}

type ExecuteTokenTransferButtonInternalProps = {
  tt: TokenTransfer & {
    token: Token;
  };
}

const ExecuteTokenTransferButtonInternal: React.FC<ExecuteTokenTransferButtonInternalProps> = ({ tt }) => {
  const { execute, state } = useExecuteTokenTransfer(tt);
  // TODO disable button; tx status; verify chainId switch behavior

  const isDisabled =
    state.status == 'PendingSignature' ||
    state.status == 'Mining' ||
    state.status == 'CollectingSignaturePool' ||
    state.status == 'Success';

  const statusNote: string = (() => {
    switch (state.status) {
      case 'None': return '';
      case 'PendingSignature': return ' (sign in wallet)';
      case 'Mining': return ' (processing...)';
      case 'CollectingSignaturePool': return ' (multisig collecting signatures)';
      case 'Success': return ' (paid)';
      case 'Fail': return ' (failed)';
      case 'Exception': return ''; // eg. user refused the signature, so instead of displaying an error, we'll render no status and they may retry
    }
  })();

  return <button disabled={isDisabled} className={`rounded-md bg-gradient-to-br from-violet-500 to-blue-500 px-3.5 py-2 text-sm font-medium transition hover:hue-rotate-30 active:scale-95 active:hue-rotate-60 ${isDisabled ? 'border-black text-grey' : 'text-white'}`} onClick={execute}>Pay Now{statusNote}</button>;
}

function useExecuteTokenTransfer(tt: TokenTransfer & {
  token: Token; // TODO support native currency transfers. This type intersection is a way to ensuring that the passed TokenTransfer is for a Token and not a NativeCurrency --> when supporting Native Currency, there's a problem to solve of conditional execution of hooks (eg. because useContractFunction uses the Contract which is only constructed for Tokens and not NativeCurrencies)
}): {
  state: TransactionStatus;
  execute: () => void;
} {
  const { account, library: provider } = useEthers();
  const c: Contract = new Contract(tt.token.address, abis.erc20, provider);
  const { send: unsafeSend, state } = useContractFunction(c, 'transfer');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeSend: (...args: any[]) => Promise<void | TransactionReceipt> = async (...args) => { // the idea behind safeSend is to be a final line of defense against accidentally signing a transaction on an unintended network; especially to avoid accidentally signing a mainnet transaction in a testnet context
    if (provider === undefined) return Promise.reject("safeSend: provider undefined");
    else {
      const { chainId } = await provider.getNetwork(); // here we fetch an up-to-date chainId from the provider so as to ensure we're checking the safety of the chainId that's actually active instead of using a chainId cached in this component's state, which may be stale by the time this callback is invoked
      if (chainId !== undefined && allChainIds.includes(chainId)) return unsafeSend(...args);
      else return Promise.reject(`safeSend: refusing to send a transaction on chainId=${chainId} because this chainId was not in the global list of active chainIds, which may indicate the user is about to sign a production transaction in a test context (eg. accidentally spend real ETH while in test mode)`);
    }
  };
  return {
    state,
    execute: async () => {
      if (provider === undefined) return Promise.reject("useExecuteTokenTransfer: provider undefined");
      else if (account !== tt.fromAddress) return Promise.reject(`useExecuteTokenTransfer: currently connected wallet=${account} is as different address than TokenTransfer.fromAddress=${tt.fromAddress}`); // WARNING here we treat TokenTransfer execution as a no-op if the current connected wallet address (which is the implicit sender of the tx) is not equal to the fromAddress in the tokenTransfer. TODO I'm not sure what to do here-- strategies can only be computed in the context of a fromAddress, but after they have been computed, they seem to execute in the context of whatever connected wallet. And that strategy's transaction could fail at runtime in the wallet if the token balance isn't present, eg. if the user's active wallet isn't the same one for which the strategies were computed or if the wallet's token balances have become stale and the transfer has become unaffordable
      else {
        const { chainId } = await provider.getNetwork(); // here we fetch an up-to-date chainId from the provider so as to ensure we're using the chainId that's actually active instead of using a chainId cached in this component's state, which may be stale by the time this callback is invoked
        if (chainId === undefined) return Promise.reject("useExecuteTokenTransfer: connected wallet chainId was unexpectedly undefined");
        else if (chainId !== tt.token.chainId) {
          // The connected wallet's selected network is not the same network as the token transfer is on. We'll pop up a network switch request, and user will then have to click the Pay button again after switching network
          switchNetwork(provider, tt.token.chainId).then(() => safeSend(tt.toAddress, BigNumber.from(tt.amountAsBigNumberHexString)));
        } else safeSend(tt.toAddress, BigNumber.from(tt.amountAsBigNumberHexString));
      }
    },
  };
}
