import { verifyTransfer } from "@3cities/verifier";
import type { ConnectRouter } from "@connectrpc/connect";
import { transferVerificationRequestFromProto } from "./fromProto";
import { TransferVerificationService } from "./gen/threecities/v1/transfer_verification_connect";
import { TransferVerificationResponse } from "./gen/threecities/v1/transfer_verification_pb";
import { wagmiConfig } from "./wagmiConfig";

export default (router: ConnectRouter) =>
  router.service(TransferVerificationService, {
    async transferVerification(reqPb) {
      const [req, reqError] = transferVerificationRequestFromProto(reqPb);
      if (reqError) return {
        isVerified: false,
        description: "Request error",
        error: reqError.message,
      }; else {
        const res = await verifyTransfer({
          wagmiConfig,
          req,
        });
        return {
          isVerified: res.isVerified,
          description: res.description,
          ...(res.error && { error: res.error?.message } satisfies Pick<TransferVerificationResponse, 'error'>),
        };
      }
    },
  });
