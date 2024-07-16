import { hasOwnPropertyOfType, type Caip222StyleMessageToSign } from '@3cities/core';
import { type TransferVerificationRequest } from '@3cities/verifier';
import { isHex } from "viem";
import { TransferVerificationRequest as TransferVerificationRequestPb } from "./gen/threecities/v1/transfer_verification_pb";

export function transferVerificationRequestFromProto(pb: TransferVerificationRequestPb): [TransferVerificationRequest, undefined] | [undefined, Error] {

  try {
    if (pb.trusted === undefined) throw Error(`trusted must be defined`);
    else if (pb.untrustedToBeVerified === undefined) throw Error(`untrusted must be defined`);
    const currency = ((): 'USD' => {
      const c = pb.trusted.currency;
      if (c === 'USD') return c;
      else throw Error(`trusted.currency must be 'USD' but it was '${c}'`);
    })();
    const logicalAssetAmount: bigint = (() => {
      try {
        return BigInt(pb.trusted.logicalAssetAmount);
      } catch (err) {
        throw Error(`trusted.logicalAssetAmount must be a bigint as a string`);
      }
    })();
    const usdPerEth: number = (() => {
      const u = pb.trusted.usdPerEth;
      if (u === 0) throw Error(`trusted.usdPerEth was 0 and must be provided`);
      else return u;
    })();
    const receiverAddress: `0x${string}` = (() => {
      const r = pb.trusted.receiverAddress;
      if (isHex(r)) return r;
      else throw Error(`trusted.receiverAddress must be an address`);
    })();
    const chainId: number = (() => {
      const c = pb.untrustedToBeVerified.chainId;
      if (c === 0) throw Error(`untrustedToBeVerified.chainId was 0 and must be provided (0 is not a valid chain ID)`);
      return c;
    })();
    const transactionHash: `0x${string}` = (() => {
      const h = pb.untrustedToBeVerified.transactionHash;
      if (isHex(h)) return h;
      else throw Error(`untrustedToBeVerified.transactionHash must be an address`);
    })();
    const senderAddress: `0x${string}` | undefined = (() => {
      const a = pb.untrustedToBeVerified.senderAddress;
      if (a.length < 1) return undefined;
      else if (isHex(a)) return a;
      else throw Error(`untrustedToBeVerified.senderAddress must be undefined or an address`);
    })();
    const caip222StyleSignature: TransferVerificationRequest['untrustedToBeVerified']['caip222StyleSignature'] = (() => {
      const c = pb.untrustedToBeVerified.caip222StyleSignature;
      if (c === undefined) return undefined;
      else {
        const message: Caip222StyleMessageToSign = (() => {
          let raw: unknown = undefined;
          try {
            raw = JSON.parse(c.message);
          } catch (err) {
            throw Error(`untrustedToBeVerified.caip222StyleSignature.message JSON deserialize failed: ${err}`);
          }
          if (typeof raw !== 'object') throw Error(`untrustedToBeVerified.caip222StyleSignature.message did not JSON deserialize into an object`);
          else if (hasOwnPropertyOfType(raw, 'senderAddress', "string")) {
            if (isHex(raw.senderAddress)) return { senderAddress: raw.senderAddress };
            else throw Error(`untrustedToBeVerified.caip222StyleSignature.message was shaped like { senderAddress: string }, but sender address must be an address`);
          } else throw Error(`untrustedToBeVerified.caip222StyleSignature.message was not shaped like { senderAddress: string }`);
        })();
        const signature = (() => {
          if (isHex(c.signature)) return c.signature;
          else throw Error(`untrustedToBeVerified.caip222StyleSignature.signature was not hex`);
        })()

        return {
          message,
          signature,
        };
      }
    })();
    const req: TransferVerificationRequest = {
      trusted: {
        currency,
        logicalAssetAmount,
        tokenTickerAllowlist: pb.trusted.tokenTickerAllowlist,
        usdPerEth,
        receiverAddress,
      },
      untrustedToBeVerified: {
        chainId,
        transactionHash,
        senderAddress,
        caip222StyleSignature,
      },
    };
    return [req, undefined];
  } catch (e) {
    return [undefined, Error(`${e} req: ${pb.toJsonString()}`)];
  }
}
