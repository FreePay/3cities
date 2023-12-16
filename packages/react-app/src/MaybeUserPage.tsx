import { isAddress } from "@ethersproject/address";
import React from "react";
import { useParams } from "react-router-dom";
import { AddressOrEnsName } from "./AddressOrEnsName";
import { CheckoutSettings } from "./CheckoutSettings";
import { CheckoutSettingsContext } from "./CheckoutSettingsContext";
import { ConversionWrapperWithChildren } from "./ConversionWrapper";
import { Pay } from "./Pay";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";
import { parseLogicalAssetAmount } from "./logicalAssets";
import { mightBeAnEnsName } from "./mightBeAnEnsName";

export const MaybeUserPage: React.FC = () => {
  // const { isConnected } = useAccount();
  const params = useParams();
  const pageName: string | undefined = params['pageName'];
  const pageNameLowerCase: string | undefined = pageName?.toLowerCase();
  const pageNameAsAddress: `0x${string}` | undefined = pageNameLowerCase && isAddress(pageNameLowerCase) ? pageNameLowerCase : undefined;
  const pageNameAsPossiblyAnEnsName: string | undefined = mightBeAnEnsName(pageName) ? pageName : undefined;
  const derivedPayReceiver: AddressOrEnsName | undefined = pageNameAsAddress ? { address: pageNameAsAddress } : pageNameAsPossiblyAnEnsName ? { ensName: pageNameAsPossiblyAnEnsName } : undefined;

  if (!derivedPayReceiver) {
    throw {
      status: 404,
      statusText: `${pageName} Not Found`,
    };
  } else {
    const cs: CheckoutSettings = {
      proposedPayment: {
        receiver: derivedPayReceiver,
        logicalAssetTickers: new PrimaryWithSecondaries('USD', ['ETH']),
        paymentMode: {
          payWhatYouWant: {
            isDynamicPricingEnabled: true,
            canPayAnyAsset: true,
            suggestedLogicalAssetAmountsAsBigNumberHexStrings: [
              parseLogicalAssetAmount('5').toHexString(),
              parseLogicalAssetAmount('10').toHexString(),
              parseLogicalAssetAmount('20').toHexString(),
              parseLogicalAssetAmount('50').toHexString(),
              parseLogicalAssetAmount('100').toHexString(),
            ],
          },
        },
      },
      receiverStrategyPreferences: {},
      senderNoteSettings: { mode: 'NONE' },
    };
    // TODO how to unify this use of CheckoutSettingsContext and ConversionWrapperWithChildren with ordinary providers/wrappers in Routes?
    return <CheckoutSettingsContext.Provider value={cs}>
      <ConversionWrapperWithChildren>
        <Pay />
        {/* {isConnected && <p className="mt-4"><FaExclamationTriangle className="inline mr-2" />To avoid loss of funds, please ensure receiver is an EOA and not smart account. In future, 3cities will support auto detect and config for smart accounts.</p>} */}
      </ConversionWrapperWithChildren>
    </CheckoutSettingsContext.Provider>;
  }
};
