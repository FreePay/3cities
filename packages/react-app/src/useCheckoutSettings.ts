import { type LogicalAssetTicker, allLogicalAssetTickers, parseLogicalAssetAmount } from "@3cities/core";
import { useContext, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { isHex, parseUnits } from "viem";
import { type AuthenticateSenderAddress, type CheckoutSettings } from "./CheckoutSettings";
import { CheckoutSettingsContext, type CheckoutSettingsRequiresPassword, isCheckoutSettingsRequiresPassword } from "./CheckoutSettingsContext";
import { type ProposedPayment, isProposedPaymentWithFixedAmount } from "./Payment";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";

// useCheckoutSettings returns the contextual CheckoutSettings that's
// been provided by CheckoutSettingsProvider, or a
// CheckoutSettingsRequiresPassword indicating that the contextual
// CheckoutSettings requires a password to proceed, upon which the
// checkout settings will be provided normally, or throws an error if
// useCheckoutSettings is used in a component that isn't a descendant of
// CheckoutSettingsProvider.
export function useCheckoutSettings(): CheckoutSettings | CheckoutSettingsRequiresPassword {
  const cs: CheckoutSettings | CheckoutSettingsRequiresPassword | undefined = useApplyUrlParamOverrides(useContext(CheckoutSettingsContext));
  if (!cs) throw new Error("useCheckoutSettings must be used within a descendant of CheckoutSettingsProvider");
  else return cs;
}

// TODO WARNING this override method is temporary and poorly designed. It shouldn't be computed and applied here at the point of useCheckoutSettings. Instead, we need to think more about the concepts of (i) overrides themselves, (ii) parsing override elements from url params, (iii) constructing override total data from the override elements, (iv) applying these overrides to a given base CheckoutSettings, and (v) running the override process at a sensible place during the control flow. For example, is the space of overrides simply CheckoutSettings itself? Is it a subset? Disjoint? What if we want to apply overrides in a context beyond useCheckoutSettings? What if we want overrides to be visible upstream of useCheckoutSettings?
function useApplyUrlParamOverrides(csIn: CheckoutSettings | CheckoutSettingsRequiresPassword | undefined): CheckoutSettings | CheckoutSettingsRequiresPassword | undefined {
  const [searchParams] = useSearchParams();
  const chainIdsRaw: string | undefined = searchParams.get("chainIds") || undefined;
  const mode: string | undefined = searchParams.get("mode") || undefined;
  const receiverAddress: `0x${string}` | undefined = (() => {
    const raw = searchParams.get("receiverAddress");
    return isHex(raw) ? raw : undefined;
  })();
  const currency: string | undefined = searchParams.get("currency") || undefined;
  const usdPerEth: string | undefined = searchParams.get("usdPerEth") || undefined;
  const logicalAssetAmountFullPrecision: string | undefined = searchParams.get("amount") || undefined; // iff set, the proposed payment mode will be overridden to be fixed using this passed logical asset amount denominated in full precision logical asset units (eg. 1 logical asset == 10^18)
  const requireInIframeOrErrorWith: string | undefined = searchParams.get("requireInIframeOrErrorWith") || undefined;
  const iframeParentWindowOrigin: string | undefined = searchParams.get("iframeParentWindowOrigin") || undefined;
  const authenticateSenderAddress: boolean = ((searchParams.get("authenticateSenderAddress") || undefined)?.length || 0) > 0;
  const verifyEip1271Signature: boolean = ((searchParams.get("verifyEip1271Signature") || undefined)?.length || 0) > 0;
  const clickToCloseIframeLabel: string | undefined = searchParams.get("clickToCloseIframeLabel") || undefined;
  const requireNativeTokenTransferProxy: boolean = ((searchParams.get("requireNativeTokenTransferProxy") || undefined)?.length || 0) > 0;
  // @eslint-no-use-below[searchParams] -- all search params have now been assigned. Further use of searchParams is not expected

  const csOut = useMemo<CheckoutSettings | CheckoutSettingsRequiresPassword | undefined>(() => {
    if (csIn === undefined || isCheckoutSettingsRequiresPassword(csIn)) return csIn;
    else {
      let cs = csIn;
      const chainIds: number[] = chainIdsRaw ? chainIdsRaw.split(",").map((s) => parseInt(s)).filter(n => !isNaN(n)) : [];
      if (chainIds.length > 0) {
        cs = { ...cs, receiverStrategyPreferences: { ...cs.receiverStrategyPreferences, acceptedChainIds: { allowlist: new Set(chainIds) } } };
      }

      if (mode?.toLowerCase() === "deposit") cs = { ...cs, mode: "deposit" };

      if (receiverAddress) {
        cs = {
          ...cs,
          proposedPayment: {
            ...cs.proposedPayment,
            receiver: {
              address: receiverAddress,
            },
          },
        };
      }

      const newPrimaryLat: LogicalAssetTicker | undefined = allLogicalAssetTickers.find((lat) => lat === currency?.toUpperCase());
      if (newPrimaryLat && cs.proposedPayment.logicalAssetTickers.primary !== newPrimaryLat) {
        const newSecondaries = [...cs.proposedPayment.logicalAssetTickers.secondaries.filter((lat) => lat !== newPrimaryLat), cs.proposedPayment.logicalAssetTickers.primary];
        const logicalAssetTickers = new PrimaryWithSecondaries(newPrimaryLat, newSecondaries);
        // TODO adopt a lens library (like monocle in scala) instead of this mess:
        cs = {
          ...cs,
          // The following curious block of code is needed because until the type guard isProposedPaymentWithFixedAmount is executed, TypeScript can't infer that `cs.proposedPayment.paymentMode` is assignable to Payment.paymentMode:
          proposedPayment: isProposedPaymentWithFixedAmount(cs.proposedPayment) ? {
            ...cs.proposedPayment,
            logicalAssetTickers,
            paymentMode: cs.proposedPayment.paymentMode,
          } satisfies ProposedPayment : {
            ...cs.proposedPayment,
            logicalAssetTickers,
            paymentMode: {
              payWhatYouWant: {
                ...cs.proposedPayment.paymentMode.payWhatYouWant,
                suggestedLogicalAssetAmounts: newPrimaryLat === 'USD' ? [ // NB the idea here is that if we're overriding the primary currency and prior suggested amounts exist, we will attempt to rewrite those suggested amounts with sane defaults for the new primary currency. Otherwise, the old suggested amounts may make no sense (eg. a suggested logical amount of '100' is $100 for USD, which is reasonable, but 100 ETH for ETH, which is not reasonable.) --> TODO when we support overriding suggested amounts, we could instead here always erase any prior suggested amounts and then the user can optionally override them for the overridden primary currency
                  parseLogicalAssetAmount('5'),
                  parseLogicalAssetAmount('10'),
                  parseLogicalAssetAmount('20'),
                  parseLogicalAssetAmount('50'),
                  parseLogicalAssetAmount('100'),
                ] : newPrimaryLat === 'ETH' ? [
                  parseLogicalAssetAmount('0.01'),
                  parseLogicalAssetAmount('0.05'),
                  parseLogicalAssetAmount('0.25'),
                  parseLogicalAssetAmount('0.5'),
                  parseLogicalAssetAmount('1'),
                ] : [],
              },
            },
          } satisfies ProposedPayment,
        }
      }

      if (usdPerEth) {
        const usdPerEthParsed = parseFloat(usdPerEth);
        if (!isNaN(usdPerEthParsed)) {
          cs = {
            ...cs,
            exchangeRates: {
              ETH: { USD: usdPerEthParsed }, // ie. this rate is USD/ETH because the numerator is nested
              USD: { ETH: 1 / usdPerEthParsed }, // ie. this rate is ETH/USD because the numerator is nested. WARNING here we set ETH/USD to ensure consistency with USD/ETH. If we didn't set it, then 3cities might internally provide a different rate
            },
          };
        }
      }

      if (logicalAssetAmountFullPrecision) {
        cs = {
          ...cs,
          proposedPayment: {
            ...cs.proposedPayment,
            paymentMode: {
              logicalAssetAmount: parseUnits(logicalAssetAmountFullPrecision, 0),
            },
          },
        };
      }

      if (requireInIframeOrErrorWith) cs = { ...cs, requireInIframeOrErrorWith };

      if (iframeParentWindowOrigin) cs = { ...cs, iframeParentWindowOrigin: iframeParentWindowOrigin };

      if (authenticateSenderAddress) cs = {
        ...cs,
        ...(authenticateSenderAddress && {
          authenticateSenderAddress: {
            ...(verifyEip1271Signature && { verifyEip1271Signature } satisfies Pick<AuthenticateSenderAddress, 'verifyEip1271Signature'>),
          },
        } satisfies Pick<CheckoutSettings, "authenticateSenderAddress">),
      };

      if (clickToCloseIframeLabel) cs = { // TODO support more of the SuccessAction API via url params
        ...cs,
        successAction: {
          closeWindow: {
            ifStandaloneWindow: {},
            ifIframe: {
              clickToClose: {
                callToAction: clickToCloseIframeLabel,
              }
            },
          },
        },
      };

      if (requireNativeTokenTransferProxy) cs = { ...cs, nativeTokenTransferProxy: "require" }; // TODO support full nativeTokenTransferProxy API

      return cs;
    }
  }, [csIn, chainIdsRaw, mode, receiverAddress, currency, usdPerEth, logicalAssetAmountFullPrecision, requireInIframeOrErrorWith, iframeParentWindowOrigin, authenticateSenderAddress, verifyEip1271Signature, clickToCloseIframeLabel, requireNativeTokenTransferProxy]);

  return csOut;
}
