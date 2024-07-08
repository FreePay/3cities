import { useCallback, useEffect, useMemo, useState } from "react";
import { UserRejectedRequestError, hashTypedData } from "viem";
import { useAccount, useReadContract, useSignTypedData, useSwitchChain, useVerifyTypedData } from 'wagmi';
import { mainnet, sepolia } from "./chains";
import { hasOwnPropertyOfType } from "./hasOwnProperty";
import { isProduction } from "./isProduction";
import { useLiveReloadQueryOptions } from "./useLiveReloadQueryOptions";

// ERC-1271
// isValidSignature(bytes32 hash, bytes signature) → bytes4 magicValue
export const smartAccountAbi = [
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

export const eip1271MagicValue = "0x1626ba7e" as const;

export const domain = {
  name: '3cities',
  version: '1',
  // NB chainId is not needed for our message as we only want to prove sender address ownership (on any chain, assuming it then applies to all chains). Note that any chainId provided here is purely signed data and not actually used by any wallet to eg. switch to that chainId prior to signing
} as const;

export const types = {
  SenderAddress: [
    { name: 'senderAddress', type: 'address' },
  ],
} as const;

export const primaryType = 'SenderAddress' as const;

export type Caip222StyleSignature = `0x${string}` | `eip1271-chainId-${number}`; // a successfully collected Caip222-style signature. `0x${string}` indicates an ordinary signature. `eip1271-chainId-${number}` indicates a smart contract wallet verified the message using eip1271 verification via a isValidSignature call on the provided chainId

export type Caip222StyleMessageToSign = {
  senderAddress: `0x${string}`;
};

type UseCaip222StyleSignatureParams = {
  enabled?: boolean; // iff true, the subsystem will attempt to collect a signature. If undefined or false, the subsystem will be disabled and will always return idle
  eip1271ChainId: number | undefined; // chain on which eip1271 isValidSignature verification will be attempted. Smart contract wallets implementing eip1271, like Gnosis Safe, don't actually produce signatures for signed messages. Instead, they keep an onchain collection of verified hashes of "signed" messages. This chain ID must be provided, or signature generation will never be attempted and the result will never become available, because this library currently doesn't know if the connected address uses ordinary signature generation/verification or eip1271-based signature verification.
}

export const caip222ChainId: number = isProduction ? mainnet.id : sepolia.id; // in certain caip222Style contexts, a concrete chainId is needed. When a chainId is needed, this one must be used.

// useCaip222StyleSignature is an API to ask the user to sign a
// CAIP-222-style message to verify ownership of the connected address.
// It's compatible if the connected wallet address is an EOA (eg.
// metamask or coinbase wallet), EIP-1271 smart contract wallet (eg.
// gnosis safe), or ERC-6492 counterfactually deployed smart contract
// wallet (eg. coinbase smart wallet). TODO comply with CAIP-222.
// https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-222.md
export function useCaip222StyleSignature({ enabled: useCaip222StyleSignatureEnabled = false, eip1271ChainId }: UseCaip222StyleSignatureParams): ({
  message?: Caip222StyleMessageToSign; // message that was signed
  signature?: Caip222StyleSignature; // the generated signature
  sign?: () => void; // function that client may call to trigger signature collection from the connected wallet
  signRejected: boolean; // true iff the user rejected the signature request
  signCalledAtLeastOnce: boolean; // true iff the sign function was called at least once
  error?: Error;
  isError: boolean;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  status: "error" | "success" | "loading" | "idle";
  loadingStatus?: "SigningInProgress" | "Other"; // defined iff status is loading. "SigningInProgress" when useSignTypedData is pending, else "Other"
  reset: () => void;
} & ({
  message?: never;
  signature?: never;
  sign?: never;
  signRejected: false;
  signCalledAtLeastOnce: boolean;
  error: Error;
  isError: true;
  isIdle: false;
  isLoading: false;
  isSuccess: false;
  status: "error";
  loadingStatus?: never;
  reset: () => void;
} | {
  message: Caip222StyleMessageToSign;
  signature: Caip222StyleSignature;
  sign?: never;
  signRejected: false;
  signCalledAtLeastOnce: boolean;
  error?: never;
  isError: false;
  isIdle: false;
  isLoading: false;
  isSuccess: true;
  status: "success";
  loadingStatus?: never;
  reset: () => void;
} | {
  message?: never;
  signature?: never;
  sign?: never;
  signRejected: false;
  signCalledAtLeastOnce: boolean;
  error?: never;
  isError: false;
  isIdle: false;
  isLoading: true;
  isSuccess: false;
  status: "loading";
  loadingStatus: "SigningInProgress" | "Other";
  reset: () => void;
} | {
  message?: never;
  signature?: never;
  sign?: () => void;
  signRejected: boolean;
  signCalledAtLeastOnce: boolean;
  error?: never;
  isError: false;
  isIdle: true;
  isLoading: false;
  isSuccess: false;
  status: "idle";
  loadingStatus?: never;
  reset: () => void;
})) {
  const { address: connectedAddress, connector: activeConnector, chain: activeChain } = useAccount();

  const messageToSign = useMemo((): Caip222StyleMessageToSign | undefined => (connectedAddress ? { senderAddress: connectedAddress } : undefined), [connectedAddress]); // design note: it's important that messageToSign not be conditional on eip1271ChainId (or any chain id) because we don't want the subsystem to reset (and clear any successful signature) every time a contextual chain changes (for eip1271ChainId with the client Pay is when bestStrategy changes, this can occur at any time as payment conditions change)

  const [eip1271VerificationEnabled, setEip1271VerificationEnabled] = useState(true); // eip1271 verification is enabled by default from initialization to detect if useSignData is needed (always needed for non-eip1271 wallets, detected via eip1271 verification error; and needed for eip1271 wallets if the wallet hasn't previously signed this message on the passed eip1271ChainId). eip1271 is only disabled after this hook succeeds in providing a signature, to prevent needless polling (including if eip1271ChainId were to change for any reason after success, which can happen in 3cities if Pay's bestStrategy changes during transaction signing)

  const [signTypedDataEnabled, setSignTypedDataEnabled] = useState(false); // see note in setSignTypedDataEnabled useEffect below

  const queryOpts = useLiveReloadQueryOptions();
  const { error: eip1271ContractReadError, isSuccess: eip1271ContractReadIsSuccess, data: eip1271RawResult } = useReadContract(messageToSign && eip1271ChainId ? {
    abi: smartAccountAbi,
    chainId: eip1271ChainId,
    address: connectedAddress,
    functionName: 'isValidSignature',
    args: [hashTypedData({
      domain,
      types,
      primaryType,
      message: messageToSign,
    }), '0x'],
    query: {
      ...queryOpts,
      enabled: queryOpts.enabled && useCaip222StyleSignatureEnabled && eip1271VerificationEnabled,
      retry: false, // NB wagmi default is to retry 3 times when a query fails. However we want this query to fail fast, as it's designed to rapidly detect whether the active wallet may have a pre-existing eip1271 signature, and then it'll be repolled for any newly generated eip1271 signature
      notifyOnChangeProps: ['error', 'isSuccess', 'data'],
    },
  } : undefined);

  const eip1271VerificationSuccessful = eip1271ContractReadIsSuccess && eip1271RawResult === eip1271MagicValue;

  useEffect(() => {
    if (eip1271ContractReadError && !signTypedDataEnabled) setSignTypedDataEnabled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we only want to enable signTypedData if only if eip1271 ever errored. For non-eip1271 wallets, this has the effect of enabling ordinary signature generation as soon as the wallet is detected as being non-eip1271. For eip1271 wallets, this has the effect of enabling the eip1271 onchain message hash to be signed as soon as the wallet is detecte as having not previously signed this message. Once signTypedData is enabled, we never disable unless this subsystem is reset via the connected wallet address changing.
  }, [eip1271ContractReadError]);

  const { signTypedData, data: rawSignature, reset: resetUseSignTypedData, isSuccess: useSignTypedDataIsSuccess, isPending: useSignTypedDataIsPending, isIdle: useSignTypedDataIsIdle, error: useSignTypedDataError } = useSignTypedData(); // NB we refer to the signature here as `rawSignature` because it's not necessarily included as the result, it depends on eip1271 status. TODO consider making use of the returned `variables` that includes type information for the message that was signed so that clients may reflectively determine signed data contents

  const [signCalledAtLeastOnce, setSignCalledAtLeastOnce] = useState(false); // provided to the client to indicate if sign was called at least once, eg. for the client to know if the user clicked sign or if it was never clicked

  const doesSignatureDependOnActiveChain: boolean = (() => { // afaict, there are effectively three kinds of wallets in terms of signature generation and verification. (1) EOA wallets generate the same signature for the passed message regardless of which chain is currently active in the wallet; (2) eip1271 smart contract wallets must have their signature virtually generated on a specific chain (ie hashed onchain), and then verified on a specific chain, which we handle via our eip127-chainId- convention and the code path of readContract for isValidSignature; (3) counterfactually instantiated smart contract wallets, such as coinbase smart wallet. This third kind of wallet generates a different signature hash depending on which chain is active at the time of signTypedData execution. For us to be able to deterministically verify one of these signatures, we need to ensure it's always generated while the wallet has a specific chain active. To implement this, we attempt to detect if the active wallet's signatures depend on its active chain.
    const isCoinbaseSmartWallet: boolean = Boolean(activeConnector && activeConnector.name === "Coinbase Wallet"); // NB both coinbase wallet (EOA) and coinbase smart wallet (type 3 in the description above) use the same connector, so this predicate will result in a false positive for coinbase wallet. But that's ok, as coinbase wallet has automatic chain switching and the chain switch below will succeed silently.
    return isCoinbaseSmartWallet;
  })();

  const { switchChainAsync, isIdle: switchChainIsIdle, error: switchChainError, reset: resetSwitchChain } = useSwitchChain();

  const sign = useMemo((): (() => Promise<void>) | undefined => signTypedDataEnabled && messageToSign ? async () => {
    setSignCalledAtLeastOnce(true);
    try {
      if (doesSignatureDependOnActiveChain && (activeChain === undefined || activeChain.id !== caip222ChainId)) await switchChainAsync({ chainId: caip222ChainId }); // NB the reason we bother computing `doesSignatureDependOnActiveChain` and don't just switchChain for all wallets is because for some wallets, that would result in potentially multiple switch chain pop-ups per checkout. Eg. with MetaMask, one switch chain prior to the signature, and then another switch chain for the chosen payment method - that'd be terrible UX.
      signTypedData({
        domain,
        types,
        primaryType,
        message: messageToSign,
      });
    } catch (e) {
      console.error("useCaip222StyleSignature switchChainAsync error", e);
    }
  } : undefined, [activeChain, messageToSign, signTypedDataEnabled, doesSignatureDependOnActiveChain, signTypedData, switchChainAsync]);

  const { data: useSignTypedDataIsVerified, isLoading: useVerifyTypedDataIsLoading, error: useVerifyTypedDataError } = useVerifyTypedData({
    // WARNING passing `chainId` here as some wallets (like coinbase smart wallet) will sign the message in the context of whatever chain they currently have selected, and then verification will fail if the passed chainId doesn't match this currently selected chain. Instead, we don't pass chainId and the wallet will sign and verify the message in the context of the same chain
    chainId: caip222ChainId, // NB see the discussion above about "three kinds of wallets". For (1) EOA wallets, it doesn't matter on which chainId the signature is verified, but we pass it to ensure the chainId on which verification occurs is supported by our wagmiConfig. For (2) eip1271 smart contract wallets, useVerifyTypedData is unused because useSignTypedData hangs in pending forever. For (3) counterfactually instantiated smart contract wallets, the chainId used for verification is highly meaningful because the signatures generated are conditional on the active chain at the time of generation, and so WARNING this chainId must match the chainId on which the counterfactual smart wallet signature was generated.
    address: connectedAddress,
    domain,
    types,
    primaryType,
    message: messageToSign,
    signature: rawSignature,
  });

  const [successSignature, setSuccessSignature] = useState<Caip222StyleSignature | undefined>(undefined);
  useEffect(() => {
    let computedSig: Caip222StyleSignature | undefined;
    if (eip1271ChainId && eip1271VerificationSuccessful) computedSig = `eip1271-chainId-${eip1271ChainId}`;
    else if (useSignTypedDataIsSuccess && useSignTypedDataIsVerified) computedSig = rawSignature;
    if (computedSig) {
      setSuccessSignature(computedSig);
      setEip1271VerificationEnabled(false); // WARNING here we must disable eip1271 query polling, lest it run forever despite the subsystem finishing in the success state
      setSignTypedDataEnabled(false); // WARNING here we must disable useSignTypedData as with eip1271 it's not needed, and without eip1271 we don't want any potential new errors affecting our result type, which will now be success
      resetUseSignTypedData(); // here we must reset any attempt in progress to obtain an ordinary signature, which will never succeed for eip1271 wallets
      resetSwitchChain(); // switch chain is used only prior to signTypedData, so we reset it here as signTypedData won't be used again
    }
  }, [eip1271ChainId, eip1271VerificationSuccessful, rawSignature, resetUseSignTypedData, resetSwitchChain, useSignTypedDataIsSuccess, useSignTypedDataIsVerified]);

  const [doReset, setDoReset] = useState(false);

  useEffect(() => {
    if (doReset) {
      // WARNING here we must reset all state to initial values when subsystem logically resets
      setEip1271VerificationEnabled(true); // WARNING must be same as initial value
      setSignTypedDataEnabled(false); // WARNING must be same as initial value
      resetUseSignTypedData();
      resetSwitchChain();
      setSuccessSignature(undefined);
      setDoReset(false);
    }
  }, [doReset, resetUseSignTypedData, resetSwitchChain]);

  const reset: () => void = useCallback(() => setDoReset(true), []);

  useEffect(() => { // the system must reset iff messageToSign changes
    setDoReset(true);
  }, [messageToSign]);

  const [successDelayElapsed, setSuccessDelayElapsed] = useState(false); // at least one wallet (rabby) has a race condition where after signature processing is successful here, an immediate subsequent call (by another unrelated subsystem) to construct a transaction unconditionally+automatically+immediately fails with UserRejectedRequestError even though the user doesn't click anything. We mitigated this by adding a short delay before reporting signature success to the client.
  useEffect(() => {
    if (successSignature) {
      const timeout = setTimeout(() => {
        setSuccessDelayElapsed(true);
      }, successSignature.startsWith("eip1271") ? 0 : 1500); // WARNING here we peek into successSignature impl details to bypass success delay for all eip1271 verifications, as we have no known race conditions with these
      return () => clearTimeout(timeout);
    } else {
      setSuccessDelayElapsed(false);
      return undefined;
    }
  }, [successSignature]);

  const [isUserRejectedSignatureRequestErr, computedError]: [false, Error | undefined] | [true, undefined] = (() => {
    if (isUserRejectedSignatureRequestError(useSignTypedDataError)) return [true, undefined];
    else if (switchChainError) return [false, new Error(`SignTypedData SwitchChain: ${switchChainError.message}`, { cause: switchChainError })];
    else if (signTypedDataEnabled && useSignTypedDataError) return [false, new Error(`SignTypedData: ${useSignTypedDataError.message}`, { cause: useSignTypedDataError })];
    else if (rawSignature && useVerifyTypedDataError) return [false, new Error(`VerifyTypedData: ${useVerifyTypedDataError.message}`, { cause: useVerifyTypedDataError })];
    else if (rawSignature && !useVerifyTypedDataIsLoading && !useSignTypedDataIsVerified) return [false, new Error(`VerifyTypedData: Verification failed`)];
    // WARNING in the case where the wallet uses eip1271 but there has been some non-retryable verification error, this hook will return the loading state forever, as we currently don't include eip1271ContractReadError in the result value computation because it's potentially challenging to differentiate between an initial error (where signature hasn't been put onchain yet) and an ephemeral error (where signature hasn't confiremd onchain yet or there is an rpc error) and a permanent fatal error (where signature can't be confirmed onchain for some reason)
    else return [false, undefined];
  })();

  const ret = useMemo((): ReturnType<typeof useCaip222StyleSignature> => {
    if (!useCaip222StyleSignatureEnabled) return {
      signRejected: false,
      signCalledAtLeastOnce: false,
      isError: false,
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      status: "idle",
      reset,
    }; else if (isUserRejectedSignatureRequestErr) return {
      ...(sign && { sign, } satisfies Pick<ReturnType<typeof useCaip222StyleSignature>, "sign">),
      signRejected: true,
      signCalledAtLeastOnce,
      isError: false,
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      status: "idle",
      reset,
    }; else if (computedError) return {
      signRejected: false,
      signCalledAtLeastOnce,
      isError: true,
      isIdle: false,
      isLoading: false,
      isSuccess: false,
      status: "error",
      error: computedError,
      reset,
    }; else if (successSignature) {
      if (!messageToSign) return {
        signRejected: false,
        signCalledAtLeastOnce,
        isError: true,
        isIdle: false,
        isLoading: false,
        isSuccess: false,
        status: "error",
        error: new Error(`Signature: Message unexpectedly undefined on success`),
        reset,
      }; else if (!successDelayElapsed) return {
        signRejected: false,
        signCalledAtLeastOnce,
        isError: false,
        isIdle: false,
        isLoading: true,
        isSuccess: false,
        status: "loading",
        loadingStatus: "Other",
        reset,
      }; else return {
        signature: successSignature,
        message: messageToSign,
        signRejected: false,
        signCalledAtLeastOnce,
        isError: false,
        isIdle: false,
        isLoading: false,
        isSuccess: true,
        status: "success",
        reset,
      };
    } else if (signTypedDataEnabled && useSignTypedDataIsIdle && switchChainIsIdle) return {
      ...(sign && { sign, } satisfies Pick<ReturnType<typeof useCaip222StyleSignature>, "sign">),
      signRejected: false,
      signCalledAtLeastOnce,
      isError: false,
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      status: "idle",
      reset,
    }; else return {
      // catch-all loading state. NB that underlying loading state has multiple causes, including but not limited to the eip1271 query initially loading or waiting to see an eip1271 verification onchain, or useSignTypedData waiting for signature authorization.
      signRejected: false,
      signCalledAtLeastOnce,
      isError: false,
      isIdle: false,
      isLoading: true,
      isSuccess: false,
      status: "loading",
      loadingStatus: useSignTypedDataIsPending ? "SigningInProgress" : "Other",
      reset,
    };
  }, [useCaip222StyleSignatureEnabled, computedError, isUserRejectedSignatureRequestErr, messageToSign, reset, switchChainIsIdle, sign, signCalledAtLeastOnce, signTypedDataEnabled, successDelayElapsed, successSignature, useSignTypedDataIsIdle, useSignTypedDataIsPending]);

  return ret;
}

// isUserRejectedSignatureRequestError returns true iff the passed Error
// represents the user having rejected a request to sign the
// caip-222-style message. The error passed must be sourced from
// `useSignTypedData(...).error` or behaviour is undefined.
function isUserRejectedSignatureRequestError(e: Error | undefined | null): boolean {
  // WARNING errors passed into this function can come from a variety of upstream sources, and they may not confirm to the TypeScript typeof Error, which is why we do extra checking to ensure properties exist before we read them.
  if (e === undefined || e === null) return false;
  else if (
    (e instanceof UserRejectedRequestError) // for some popular/old wallets (such as metamask browser extension), wagmi supports mapping the underlying wallet error into a typed error.
    // for other wallets, wagmi doesn't support mapping the underlying wallet error into a typed error, so we must check the error message:
    || (hasOwnPropertyOfType(e, 'message', 'string') && e.message.includes('User rejected')) // Slingshot mobile wallet with walletconnect v2
    // TODO test more wallets
  ) return true;
  else return false;
}
