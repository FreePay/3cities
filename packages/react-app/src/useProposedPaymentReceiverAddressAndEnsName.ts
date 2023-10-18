import { useMemo } from "react";
import { ProposedPayment, isProposedPaymentWithReceiverAddress } from "./Payment";
import { useEnsAddress } from "./useEnsAddress";
import { useEnsName } from "./useEnsName";

// An important design goal of
// useProposedPaymentReceiverAddressAndEnsName, which was achieved, is
// to never return undefined for receiverAddress or receiverEnsName if
// those data are already available internally to this hook. We use
// useMemo (which returns results synchronously in a single render) and
// not useState/useEffect (which makes results available asynchronously
// over successive renders) to achieve this goal.

// useProposedPaymentReceiverAddressAndEnsName returns the
// receiverAddress and receiverEnsName for the passed ProposedPayment,
// abstracting over ProposedPayment.receiver being an address or ens
// name, and fetching the address (from passed ens name) or ens name
// (from passed address) as necessary.
export function useProposedPaymentReceiverAddressAndEnsName(p: ProposedPayment): {
  receiverAddress: `0x${string}`;
  receiverEnsName?: never;
  receiverAddressIsLoading: false;
  receiverEnsNameIsLoading: boolean;
} | {
  receiverAddress?: never;
  receiverEnsName: string;
  receiverAddressIsLoading: boolean;
  receiverEnsNameIsLoading: false;
} | {
  receiverAddress: `0x${string}`;
  receiverEnsName: string;
  receiverAddressIsLoading: false;
  receiverEnsNameIsLoading: false;
} {
  const receiverAddressInput: `0x${string}` | undefined = isProposedPaymentWithReceiverAddress(p) ? p.receiver.address : undefined;
  const receiverEnsNameInput: string | undefined = !isProposedPaymentWithReceiverAddress(p) ? p.receiver.ensName : undefined;

  const { address: receiverEnsAddressFetched, error: receiverEnsAddressFetchedError, isLoading: receiverEnsAddressFetchedIsLoading } = useEnsAddress(receiverEnsNameInput);

  const { ensName: receiverEnsNameFetched, error: receiverEnsNameFetchedError, isLoading: receiverEnsNameFetchedIsLoading } = useEnsName(receiverAddressInput);

  const result = useMemo<ReturnType<typeof useProposedPaymentReceiverAddressAndEnsName>>(() => {
    const receiverAddress: `0x${string}` | undefined = (() => {
      if (receiverAddressInput) return receiverAddressInput;
      else if (receiverAddressInput === undefined && !receiverEnsAddressFetchedError && !receiverEnsAddressFetchedIsLoading) return receiverEnsAddressFetched; else return undefined;
    })();

    const receiverEnsName: string | undefined = (() => {
      if (receiverEnsNameInput) return receiverEnsNameInput;
      else if (receiverEnsNameInput === undefined && !receiverEnsNameFetchedError && !receiverEnsNameFetchedIsLoading) return receiverEnsNameFetched;
      else return undefined;
    })();

    if (receiverAddress && receiverEnsName) return {
      receiverAddress,
      receiverEnsName,
      receiverAddressIsLoading: false,
      receiverEnsNameIsLoading: false,
    }; else if (receiverAddress) return {
      receiverAddress,
      receiverAddressIsLoading: false,
      receiverEnsNameIsLoading: receiverEnsNameFetchedIsLoading,
    }; else if (receiverEnsName) return {
      receiverEnsName,
      receiverAddressIsLoading: receiverEnsAddressFetchedIsLoading,
      receiverEnsNameIsLoading: false,
    }; else throw new Error("useProposedPaymentReceiverAddressAndEnsName: receiverAddress and receiverEnsName are both undefined"); // this can't happen because the passed proposed payment has receiver address xor ens name
  }, [receiverAddressInput, receiverEnsAddressFetched, receiverEnsAddressFetchedError, receiverEnsAddressFetchedIsLoading, receiverEnsNameInput, receiverEnsNameFetched, receiverEnsNameFetchedError, receiverEnsNameFetchedIsLoading]);

  return result;
}
