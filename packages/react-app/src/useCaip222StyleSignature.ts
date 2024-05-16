import { useEffect, useMemo } from "react";
import { UserRejectedRequestError, useAccount, useSignTypedData } from 'wagmi';
import { hasOwnPropertyOfType } from "./hasOwnProperty";

// To be able to verify this signature, the domain, types, primaryType, clear text message, signature, and expected signatory public key must be available in the verification scope --> TODO domain, types, primaryType to be moved to @3cities/core for other packages to depend on them

const domain = {
  name: '3cities',
  version: '1',
} as const;

const types = {
  SenderAddress: [
    { name: 'senderAddress', type: 'address' },
  ],
} as const;

const primaryType = 'SenderAddress' as const;

type Caip222StyleMessageToSign = {
  senderAddress: `0x${string}`;
};

// useCaip222StyleSignature is an API to ask the user to sign a
// CAIP-222-style message to verify ownership of the connected address.
// TODO comply with CAIP-222
// https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-222.md
export function useCaip222StyleSignature(): ({
  message?: Caip222StyleMessageToSign;
  signature?: string; // signature of message
  sign?: () => void; // function that client may call to trigger signature collection from the connected wallet
  signRejected: boolean; // true iff the user rejected the signature request
  error?: Error;
  isError: boolean;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  status: "error" | "success" | "loading" | "idle"
} & ({
  message?: never;
  signature?: never;
  sign?: never;
  signRejected: false;
  isError: true;
  isIdle: false;
  isLoading: false;
  isSuccess: false;
  status: "error";
} | {
  message: Caip222StyleMessageToSign;
  signature: string;
  sign?: never;
  signRejected: false;
  error?: never;
  isError: false;
  isIdle: false;
  isLoading: false;
  isSuccess: true;
  status: "success";
} | {
  message?: never;
  signature?: never;
  sign?: never;
  signRejected: false;
  error?: never;
  isError: false;
  isIdle: false;
  isLoading: true;
  isSuccess: false;
  status: "loading";
} | {
  message?: never;
  signature?: never;
  sign?: () => void;
  signRejected: boolean;
  error?: never;
  isError: false;
  isIdle: true;
  isLoading: false;
  isSuccess: false;
  status: "idle";
})) {
  const { address: connectedAddress } = useAccount();
  const messageToSign = useMemo((): Caip222StyleMessageToSign => ({
    senderAddress: connectedAddress || '0xUnusedWhenConnectedAddressUndefined', // useSignTypedData does not support being disabled and `messageToSign` must be unconditionally defined, so we pass a dummy address when wallet is disconnected which will never actually be used
  }), [connectedAddress]);

  const args = useMemo(() => {
    return {
      domain,
      value: messageToSign,
      primaryType,
      types,
    };
  }, [messageToSign]);

  const { signTypedData, data: signature, reset, status, error } = useSignTypedData(args); // TODO make use of the returned `variables` that includes type information for the message that was signed so that clients can reflectively determine signed data contents --> but, the type of `variables` is wagmi's SignTypedDataArgs which is not exported in wagmi 0.12.x --> revisit including this after upgrading wagmi

  useEffect(() => reset(), [messageToSign, reset]);

  const ret = useMemo((): ReturnType<typeof useCaip222StyleSignature> => {
    switch (status) {
      case "success": {
        if (!signature) return {
          signRejected: false,
          isError: true,
          isIdle: false,
          isLoading: false,
          isSuccess: false,
          status: "error",
          error: new Error("useCaip222StyleSignature: status is success, but signature is undefined"),
        }; else return {
          signature,
          message: messageToSign,
          signRejected: false,
          isError: false,
          isIdle: false,
          isLoading: false,
          isSuccess: true,
          status,
        };
      } case "error": {
        if (isUserRejectedSignatureRequestError(error)) return {
          ...(connectedAddress && { sign: signTypedData } satisfies Pick<ReturnType<typeof useCaip222StyleSignature>, "sign">),
          signRejected: true,
          isError: false,
          isIdle: true,
          isLoading: false,
          isSuccess: false,
          status: "idle",
        }; else return {
          signRejected: false,
          isError: true,
          isIdle: false,
          isLoading: false,
          isSuccess: false,
          status,
          error: new Error("useCaip222StyleSignature: error", error ? { cause: error } : undefined),
        };
      } case "idle": return {
        ...(connectedAddress && { sign: signTypedData } satisfies Pick<ReturnType<typeof useCaip222StyleSignature>, "sign">),
        signRejected: false,
        isError: false,
        isIdle: true,
        isLoading: false,
        isSuccess: false,
        status,
      }; case "loading": return {
        signRejected: false,
        isError: false,
        isIdle: false,
        isLoading: true,
        isSuccess: false,
        status,
      };
    }
  }, [connectedAddress, messageToSign, signTypedData, signature, status, error]);

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
