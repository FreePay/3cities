import { BigNumber } from "@ethersproject/bignumber";
import { CheckoutSettings, SenderNoteSettings } from "./CheckoutSettings";
import { NonEmptyArray, ensureNonEmptyArray } from "./NonEmptyArray";
import { PaymentMode, ProposedPayment, isPaymentModeWithFixedAmount } from "./Payment";
import { PrimaryWithSecondaries } from "./PrimaryWithSecondaries";
import { StrategyPreferences } from "./StrategyPreferences";
import { modifiedBase64Decode, modifiedBase64Encode } from "./base64";
import { decrypt, encrypt, generateSignature, makeIv, makeSalt, verifySignature } from "./crypto";
import { CheckoutSettingsEncrypted as CheckoutSettingsEncryptedPb, CheckoutSettings as CheckoutSettingsPb, CheckoutSettingsSigned as CheckoutSettingsSignedPb, LogicalAssetTicker as LogicalAssetTickerPb, MessageType as MessageTypePb, CheckoutSettings_PayWhatYouWant_PayWhatYouWantFlags as PayWhatYouWantFlagsPb, CheckoutSettings_PayWhatYouWant as PayWhatYouWantPb, CheckoutSettings_SenderNoteSettingsMode as SenderNoteSettingsModePb } from "./gen/threecities/v1/v1_pb";
import { hasOwnProperty, hasOwnPropertyOfType } from "./hasOwnProperty";
import { LogicalAssetTicker, allLogicalAssetTickers } from "./logicalAssets";
import { toUppercase } from "./toUppercase";

// TODO unit tests for serialization functions. Especially a test that generates random CheckoutSettings and uses CheckoutSettingsPb.equals() to verify the serialization->deserialization didn't change anything

const successRedirectUrlOpenInNewTabSentinelChar = '~'; // the deserialized successRedirect.openInNewTab is true iff protobuf successRedirectUrl starts with this char. This convention saves us 1 byte in binary serialization length by using a sentinel character instead of a separate bool field.

function checkoutSettingsToProto(cs: CheckoutSettings): CheckoutSettingsPb {
  type ProposedPaymentReceiver = Exclude<typeof CheckoutSettingsPb.prototype.proposedPaymentReceiver, { case: undefined; value?: undefined }>;
  const proposedPaymentReceiver = ((): ProposedPaymentReceiver => {
    if (cs.proposedPayment.receiver.address) return {
      value: ethAddressToFromBytes.to(cs.proposedPayment.receiver.address),
      case: "proposedPaymentReceiverAddress",
    }; else return {
      value: cs.proposedPayment.receiver.ensName,
      case: "proposedPaymentReceiverEnsName",
    };
  })();

  const proposedPaymentLogicalAssetTickers: LogicalAssetTickerPb[] = [cs.proposedPayment.logicalAssetTickers.primary, ...cs.proposedPayment.logicalAssetTickers.secondaries].map(lat => LogicalAssetTickerPb[lat]);

  type ProposedPaymentPaymentMode = Exclude<typeof CheckoutSettingsPb.prototype.proposedPaymentPaymentMode, { case: undefined; value?: undefined }>;
  const proposedPaymentPaymentMode = ((): ProposedPaymentPaymentMode => {
    const pm = cs.proposedPayment.paymentMode;
    if (!isPaymentModeWithFixedAmount(pm)) {
      const p = pm.payWhatYouWant;
      const flags = ((): PayWhatYouWantFlagsPb | undefined => {
        if (!p.isDynamicPricingEnabled && !p.canPayAnyAsset) return undefined;
        else if (!p.isDynamicPricingEnabled && p.canPayAnyAsset) return PayWhatYouWantFlagsPb.IS_DYNAMIC_PRICING_ENABLED_FALSE_CAN_PAY_ANY_ASSET_TRUE;
        else if (p.isDynamicPricingEnabled && !p.canPayAnyAsset) return PayWhatYouWantFlagsPb.IS_DYNAMIC_PRICING_ENABLED_TRUE_CAN_PAY_ANY_ASSET_FALSE;
        else return PayWhatYouWantFlagsPb.IS_DYNAMIC_PRICING_ENABLED_TRUE_CAN_PAY_ANY_ASSET_TRUE;
      })();
      return {
        value: new PayWhatYouWantPb({
          ...(flags && { flags }),
          suggestedLogicalAssetAmounts: p.suggestedLogicalAssetAmountsAsBigNumberHexStrings.map(a => bigIntToFromBytes.to(BigNumber.from(a).toBigInt())),
        }),
        case: "proposedPaymentPaymentModePayWhatYouWant",
      };
    } else return {
      value: bigIntToFromBytes.to(BigNumber.from(pm.logicalAssetAmountAsBigNumberHexString).toBigInt()),
      case: "proposedPaymentPaymentModeLogicalAssetAmount",
    };
  })();

  type AcceptedTokenTickers = Exclude<typeof CheckoutSettingsPb.prototype.receiverStrategyPreferencesAcceptedTokenTickers, { case: undefined; value?: undefined }>;
  const receiverStrategyPreferencesAcceptedTokenTickers = ((): AcceptedTokenTickers | undefined => {
    const a = cs.receiverStrategyPreferences.acceptedTokenTickers;
    if (a && a.allowlist) return {
      value: tokenTickersNonEmptyArrayToFromString.to(ensureNonEmptyArray(Array.from(a.allowlist), "expected non-empty allowlist of token tickers")),
      case: "receiverStrategyPreferencesAcceptedTokenTickersAllowlist",
    }; else if (a && a.denylist) return {
      value: tokenTickersNonEmptyArrayToFromString.to(ensureNonEmptyArray(Array.from(a.denylist), "expected non-empty denylist of token tickers")),
      case: "receiverStrategyPreferencesAcceptedTokenTickersDenylist",
    }; else return undefined;
  })();

  type AcceptedChainIds = Exclude<typeof CheckoutSettingsPb.prototype.receiverStrategyPreferencesAcceptedChainIds, { case: undefined; value?: undefined }>;
  const receiverStrategyPreferencesAcceptedChainIds = ((): AcceptedChainIds | undefined => {
    const a = cs.receiverStrategyPreferences.acceptedChainIds;
    if (a && a.allowlist) return {
      value: uint32NumbersToFromUint8Array.to(Array.from(a.allowlist)),
      case: "receiverStrategyPreferencesAcceptedChainIdsAllowlist",
    }; else if (a && a.denylist) return {
      value: uint32NumbersToFromUint8Array.to(Array.from(a.denylist)),
      case: "receiverStrategyPreferencesAcceptedChainIdsDenylist",
    }; else return undefined;
  })();

  const [senderNoteSettingsMode, senderNoteSettingsInstructions] = ((): [SenderNoteSettingsModePb | undefined, string | undefined] => {
    const s = cs.senderNoteSettings;
    if (s.mode === "NONE") return [undefined, undefined];
    else return [SenderNoteSettingsModePb[s.mode], s.instructions];
  })();

  const successRedirectUrl: string | undefined = (() => {
    const r = cs.successRedirect;
    if (r) {
      const prefix = r.openInNewTab ? successRedirectUrlOpenInNewTabSentinelChar : ''; // see note on successRedirectUrlOpenInNewTabSentinelChar
      return prefix + r.url;
    } else return undefined;
  })();

  return new CheckoutSettingsPb({
    checkoutSettingsMajorVersion: 1, // we serialize CheckoutSettings into our latest major version of protobuf messages, which is v1
    proposedPaymentReceiver,
    proposedPaymentLogicalAssetTickers,
    proposedPaymentPaymentMode,
    ...(receiverStrategyPreferencesAcceptedTokenTickers && {
      receiverStrategyPreferencesAcceptedTokenTickers
    }),
    ...(receiverStrategyPreferencesAcceptedChainIds && { receiverStrategyPreferencesAcceptedChainIds }),
    ...(cs.note && { note: cs.note }),
    ...(senderNoteSettingsMode && { senderNoteSettingsMode }),
    ...(senderNoteSettingsInstructions && { senderNoteSettingsInstructions }),
    ...(successRedirectUrl && { successRedirectUrl }),
    ...(cs.successRedirect?.callToAction && { successRedirectCallToAction: cs.successRedirect?.callToAction }),
    ...(cs.webhookUrl && { webhookUrl: cs.webhookUrl }),
  });
}

function checkoutSettingsFromProto(cspb: CheckoutSettingsPb): CheckoutSettings {
  try {
    if (cspb.checkoutSettingsMajorVersion !== 1) throw new Error(`illegal serialization: checkoutSettingsMajorVersion is ${cspb.checkoutSettingsMajorVersion}, expected 1`); // NB in the future, when we add a 2nd protobuf messages major version, our canonical code path (ie. this function) will expect the latest major version, but if it detects an older major version, we'll dynamically load older deserialization code that's not included in the main app bundle, and then the old serialization will be deserialized into the latest version of CheckoutSettings

    const proposedPayment = ((): ProposedPayment => {
      const proposedPaymentReceiver: ProposedPayment['receiver'] = (() => {
        switch (cspb.proposedPaymentReceiver.case) { // NB we use switch instead of an if statement to get case exhaustivity checks in linter
          case undefined: throw new Error("illegal serialization: proposedPaymentReceiver.case is undefined");
          case "proposedPaymentReceiverAddress": return { address: ethAddressToFromBytes.from(cspb.proposedPaymentReceiver.value) };
          case "proposedPaymentReceiverEnsName": return { ensName: cspb.proposedPaymentReceiver.value };
        }
      })();

      const proposedPaymentLogicalAssetTickers = ((): PrimaryWithSecondaries<LogicalAssetTicker> => {
        const lats: LogicalAssetTicker[] = cspb.proposedPaymentLogicalAssetTickers.map((latpb, i) => {
          if (latpb === LogicalAssetTickerPb.UNSPECIFIED) throw new Error(`illegal serialization: proposedPaymentLogicalAssetTickers[${i}] is UNSPECIFIED`);
          else {
            const unsafe: string = LogicalAssetTickerPb[latpb]; // WARNING although LogicalAssetTickerPb[LogicalAssetTickerPb.ETH] === "ETH", TypeScript is unable to infer that the type of LogicalAssetTickerPb[LogicalAssetTickerPb] is `keyof typeof LogicalAssetTickerPb` and instead the property access is of type `string`. So we isolate this type unsafety by verifying the value is a valid LogicalAssetTicker and then do an unsafe typecast
            if (allLogicalAssetTickers.includes(unsafe as LogicalAssetTicker)) return unsafe as LogicalAssetTicker;
            else throw new Error(`illegal serialization: proposedPaymentLogicalAssetTickers[${i}] is not a valid LogicalAssetTicker. value was ${unsafe}`);
          }
        });
        const primary = lats[0];
        if (primary === undefined) throw new Error(`illegal serialization: proposedPaymentLogicalAssetTickers is empty`);
        else return new PrimaryWithSecondaries<LogicalAssetTicker>(primary, lats.slice(1));
      })();

      const proposedPaymentPaymentMode = ((): PaymentMode => {
        const pm = cspb.proposedPaymentPaymentMode;
        switch (pm.case) { // NB we use switch instead of an if statement to get case exhaustivity checks in linter
          case undefined: throw new Error("illegal serialization: proposedPaymentPaymentMode.case is undefined");
          case "proposedPaymentPaymentModeLogicalAssetAmount": return {
            logicalAssetAmountAsBigNumberHexString: BigNumber.from(bigIntToFromBytes.from(pm.value)).toHexString(),
          };
          case "proposedPaymentPaymentModePayWhatYouWant": {
            const [isDynamicPricingEnabled, canPayAnyAsset] = ((): [boolean, boolean] => {
              switch (pm.value.flags) { // NB we use switch instead of an if statement to get case exhaustivity checks in linter
                case PayWhatYouWantFlagsPb.UNSPECIFIED: return [false, false]; // NB we define UNSPECIFIED to mean all flags are false. This saves 2 bytes of binary serialization size if all flags are false because during serialization, the field is omitted iff all flags are false, and during deserialization, we detect omission by receiving here the default value of UNSPECIFIED.
                case PayWhatYouWantFlagsPb.IS_DYNAMIC_PRICING_ENABLED_FALSE_CAN_PAY_ANY_ASSET_TRUE: return [false, true];
                case PayWhatYouWantFlagsPb.IS_DYNAMIC_PRICING_ENABLED_TRUE_CAN_PAY_ANY_ASSET_FALSE: return [true, false];
                case PayWhatYouWantFlagsPb.IS_DYNAMIC_PRICING_ENABLED_TRUE_CAN_PAY_ANY_ASSET_TRUE: return [true, true];
              }
            })();
            return {
              payWhatYouWant: {
                isDynamicPricingEnabled,
                canPayAnyAsset,
                suggestedLogicalAssetAmountsAsBigNumberHexStrings: pm.value.suggestedLogicalAssetAmounts.map(a => BigNumber.from(bigIntToFromBytes.from(a)).toHexString()),
              }
            };
          }
        }
      })();

      // The following curious block of code is needed because until the type guard isPaymentModeWithFixedAmount is executed, TypeScript can't infer that `proposedPaymentPaymentMode` is assignable to paymentMode:
      if (isPaymentModeWithFixedAmount(proposedPaymentPaymentMode)) return {
        receiver: proposedPaymentReceiver,
        logicalAssetTickers: proposedPaymentLogicalAssetTickers,
        paymentMode: proposedPaymentPaymentMode,
      } satisfies ProposedPayment; else return {
        receiver: proposedPaymentReceiver,
        logicalAssetTickers: proposedPaymentLogicalAssetTickers,
        paymentMode: proposedPaymentPaymentMode,
      } satisfies ProposedPayment;
    })();

    const receiverStrategyPreferences = ((): StrategyPreferences => {
      const acceptedTokenTickers = ((): StrategyPreferences['acceptedTokenTickers'] | undefined => {
        const a = cspb.receiverStrategyPreferencesAcceptedTokenTickers;
        switch (a.case) { // NB we use switch instead of an if statement to get case exhaustivity checks in linter
          case undefined: return undefined;
          case "receiverStrategyPreferencesAcceptedTokenTickersAllowlist": return { allowlist: new Set(tokenTickersNonEmptyArrayToFromString.from(a.value).map(toUppercase)) };
          case "receiverStrategyPreferencesAcceptedTokenTickersDenylist": return { denylist: new Set(tokenTickersNonEmptyArrayToFromString.from(a.value).map(toUppercase)) };
        }
      })();

      const acceptedChainIds = ((): StrategyPreferences['acceptedChainIds'] | undefined => {
        const a = cspb.receiverStrategyPreferencesAcceptedChainIds;
        switch (a.case) { // NB we use switch instead of an if statement to get case exhaustivity checks in linter
          case undefined: return undefined;
          case "receiverStrategyPreferencesAcceptedChainIdsAllowlist": return { allowlist: new Set(ensureNonEmptyArray(uint32NumbersToFromUint8Array.from(a.value), "expected non-empty allowlist of chain ids")) };
          case "receiverStrategyPreferencesAcceptedChainIdsDenylist": return { denylist: new Set(ensureNonEmptyArray(uint32NumbersToFromUint8Array.from(a.value), "expected non-empty denylist of chain ids")) };
        }
      })();

      return {
        ...(acceptedTokenTickers && { acceptedTokenTickers }),
        ...(acceptedChainIds && { acceptedChainIds }),
      } satisfies StrategyPreferences;
    })();

    const senderNoteSettings = ((): SenderNoteSettings => {
      const m = cspb.senderNoteSettingsMode;
      const instructions = cspb.senderNoteSettingsInstructions;
      switch (m) { // NB we use switch instead of an if statement to get case exhaustivity checks in linter
        case SenderNoteSettingsModePb.UNSPECIFIED: {
          if (instructions.length > 0) throw new Error(`illegal serialization: senderNoteSettingsInstructions is non-empty when senderNoteSettingsMode is NONE (ie. NONE === UNSPECIFIED)`);
          else return { mode: 'NONE' }; // NB we define UNSPECIFIED to mean mode "NONE". This saves 2 bytes of binary serialization size if mode is "NONE" because during serialization, the field is omitted iff "NONE", and during deserialization, we detect omission by receiving here the default value of UNSPECIFIED.
        }
        case SenderNoteSettingsModePb.OPTIONAL: return { mode: 'OPTIONAL', instructions, };
        case SenderNoteSettingsModePb.REQUIRED: return { mode: 'REQUIRED', instructions, };
      }
    })();

    const note: string | undefined = cspb.note.length > 0 ? cspb.note : undefined;

    const successRedirect = ((): CheckoutSettings['successRedirect'] | undefined => {
      if (cspb.successRedirectUrl.length < 1) {
        if (cspb.successRedirectCallToAction.length > 0) throw new Error(`illegal serialization: successRedirectCallToAction is non-empty when successRedirectUrl is empty`);
        else return undefined;
      } else {
        if (cspb.successRedirectUrl.startsWith(successRedirectUrlOpenInNewTabSentinelChar)) return { // NB see note on successRedirectUrlOpenInNewTabSentinelChar
          url: cspb.successRedirectUrl.slice(1),
          openInNewTab: true,
          ...(cspb.successRedirectCallToAction.length > 0 && { callToAction: cspb.successRedirectCallToAction }),
        }; else return {
          url: cspb.successRedirectUrl,
          openInNewTab: false,
          ...(cspb.successRedirectCallToAction.length > 0 && { callToAction: cspb.successRedirectCallToAction }),
        };
      }
    })();

    const webhookUrl: string | undefined = cspb.webhookUrl.length > 0 ? cspb.webhookUrl : undefined;

    return {
      proposedPayment: proposedPayment,
      receiverStrategyPreferences,
      ...(note && { note }),
      senderNoteSettings,
      ...(successRedirect && { successRedirect }),
      ...(webhookUrl && { webhookUrl }),
    } satisfies CheckoutSettings;
  } catch (e) {
    throw new Error("fromProto error", { cause: e });
  }
}

export function serializeCheckoutSettings(cs: CheckoutSettings): string {
  // console.log("serialize:\n", JSON.stringify(cs, (_key, value) => (value instanceof Set ? [...value] : value)), "\n\nproto json:", checkoutSettingsToProto(cs).toJsonString(), "\n\npayload:", modifiedBase64Encode(checkoutSettingsToProto(cs).toBinary()));
  return modifiedBase64Encode(checkoutSettingsToProto(cs).toBinary());
}

export function deserializeCheckoutSettings(s: string): CheckoutSettings | undefined {
  try {
    return checkoutSettingsFromProto(CheckoutSettingsPb.fromBinary(new Uint8Array(modifiedBase64Decode(s))));
  } catch (e) {
    console.error("deserializeCheckoutSettings error", e);
    return undefined;
  }
}

export type MaybeCheckoutSettings = CheckoutSettings | 'CheckoutSettingsIsEncrypted' | 'CheckoutSettingsHasSignatureToVerify' | undefined;

// deserializeCheckoutSettingsUnknownMessageType takes an anonymous
// base64-encoded binary serialization that may be one of our protobuf
// messages types or an invalid serialization and returns a deserialized
// CheckoutSettings or indicates the type of serialized message
// requiring asynchronous deserialization. Ie. decryption is an
// asynchronous API so we detect an encrypted checkout settings for
// later decryption. See design note on protobuf MessageType.
export function deserializeCheckoutSettingsUnknownMessageType(s: string): MaybeCheckoutSettings {
  const binarySerialized = new Uint8Array(modifiedBase64Decode(s));
  let ret: MaybeCheckoutSettings = undefined;

  try {
    const cse = CheckoutSettingsEncryptedPb.fromBinary(binarySerialized);
    if (cse.messageType === MessageTypePb.CHECKOUT_SETTINGS_ENCRYPTED) ret = 'CheckoutSettingsIsEncrypted';
  } catch (e) {
    // no-op, message type was not CheckoutSettingsEncrypted
  }

  try {
    const css = CheckoutSettingsSignedPb.fromBinary(binarySerialized);
    if (css.messageType === MessageTypePb.CHECKOUT_SETTINGS_SIGNED) ret = 'CheckoutSettingsHasSignatureToVerify';
  } catch (e) {
    // no-op, message type was not CheckoutSettingsSigned
  }

  if (ret === undefined) {
    try {
      ret = checkoutSettingsFromProto(CheckoutSettingsPb.fromBinary(binarySerialized));
    } catch (e) {
      console.error("deserializeCheckoutSettingsUnknownMessageType: error deserializing CheckoutSettings\n", e, ...(e instanceof Error && hasOwnProperty(e, 'cause') ? ['\n', e.cause] : []));
      ret = undefined;
    }
  }

  return ret;
}

export async function serializeCheckoutSettingsWithEncryption(cs: CheckoutSettings, password: string): Promise<string | undefined> {
  const salt = makeSalt();
  const iv = makeIv();

  const encryptedCheckoutSettings = await encrypt(checkoutSettingsToProto(cs).toBinary(), password, salt, iv).catch(e => {
    console.error('serializeCheckoutSettingsWithEncryption: encrypt error', e);
    return undefined;
  });

  if (encryptedCheckoutSettings === undefined) return undefined;
  else {
    const cse = new CheckoutSettingsEncryptedPb({
      encryptedCheckoutSettings,
      salt,
      iv,
      messageType: MessageTypePb.CHECKOUT_SETTINGS_ENCRYPTED,
    });
    return modifiedBase64Encode(cse.toBinary());
  }
}

export async function deserializeCheckoutSettingsWithEncryption(s: string, password: string): Promise<CheckoutSettings | undefined> {
  try {
    const cse = CheckoutSettingsEncryptedPb.fromBinary(new Uint8Array(modifiedBase64Decode(s)));
    return checkoutSettingsFromProto(CheckoutSettingsPb.fromBinary(await decrypt(cse.encryptedCheckoutSettings, password, cse.salt, cse.iv)));
  } catch (e) {
    console.error("deserializeCheckoutSettingsWithEncryption error", e);
    if (hasOwnPropertyOfType(e, 'message', 'string') && e.message.includes('importKey')) console.warn('Pay Link decryption unavailable in insecure browser contexts');
    return undefined;
  }
}

export async function serializeCheckoutSettingsWithSignature(cs: CheckoutSettings, password: string): Promise<string | undefined> {
  const salt = makeSalt();
  const cspb = checkoutSettingsToProto(cs);

  const signature = await generateSignature(cspb.toBinary(), password, salt).catch(e => {
    console.error('serializeCheckoutSettingsWithSignature: generateSignature error', e);
    return undefined;
  });

  if (signature === undefined) return undefined;
  else {
    const css = new CheckoutSettingsSignedPb({
      checkoutSettings: cspb,
      salt,
      signature,
      messageType: MessageTypePb.CHECKOUT_SETTINGS_SIGNED,
    });
    return modifiedBase64Encode(css.toBinary());
  }
}

export async function deserializeCheckoutSettingsWithSignature(s: string, password: string): Promise<CheckoutSettings | undefined> {
  try {
    const css = CheckoutSettingsSignedPb.fromBinary(new Uint8Array(modifiedBase64Decode(s)));
    if (!css.checkoutSettings) throw new Error('deserializeCheckoutSettingsWithSignature: illegal serialization: missing checkoutSettings');
    else {
      const { verificationSuccessful } = await verifySignature(css.checkoutSettings.toBinary(), css.signature, password, css.salt);
      if (verificationSuccessful) return checkoutSettingsFromProto(css.checkoutSettings);
      else throw new Error('deserializeCheckoutSettingsWithSignature: incorrect password');
    }
  } catch (e) {
    console.error("deserializeCheckoutSettingsWithEncryption error", e);
    if (hasOwnPropertyOfType(e, 'message', 'string') && e.message.includes('importKey')) console.warn('Pay Link decryption unavailable in insecure browser contexts');
    return undefined;
  }
}

// tokenTickersNonEmptyArrayToFromString is a serialization helper API
// that converts a NonEmptyArray<string> of token tickers to and from a
// string. This logic is quite simple yet we still centralize it here
// for consistency.
const tokenTickersNonEmptyArrayToFromString = Object.freeze({
  // WARNING here we serialize N token tickers to/from a single string
  // by relying on our precondition that token tickers have no spaces
  to: (tokenTickers: NonEmptyArray<string>): string => tokenTickers.join(' '),
  from: (tokenTickers: string): NonEmptyArray<string> => ensureNonEmptyArray(tokenTickers.split(' '), "tokenTickersNonEmptyArrayToFromString.from: expected non-empty array of token tickers"),
});

// ethAddressToFromBytes is a serialization helper API that converts an
// Ethereum address to and from a big-endian Uint8Array.
const ethAddressToFromBytes = Object.freeze({
  to(address: `0x${string}`): Uint8Array {
    const cleanAddress = address.substring(2);
    if (cleanAddress.length !== 40) throw new Error('ethAddressFromBytes.to: invalid Ethereum address length, address=' + address);
    const byteArray = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      byteArray[i] = parseInt(cleanAddress.substring(i * 2, i * 2 + 2), 16);
    }
    return byteArray;
  },
  from(bytes: Uint8Array): `0x${string}` {
    if (bytes.length !== 20) throw new Error(`ethAddressFromBytes.from: invalid bytes length for Ethereum address. Expected 20, actual ${bytes.length}`);
    else return bytes.reduce<`0x${string}`>((address, byte) => {
      return `${address}${byte.toString(16).padStart(2, '0')}`;
    }, '0x');
  },
});

// bigIntToFromBytes is a serialization helper API that converts a
// bigint >= 0 to and form a Uint8Array. The binary encoding is in
// scientific notation and optimized for bigints with many zeroes at the
// end, which is what we commonly see in 3cities logical asset amounts
// because they have 18 decimals of precision.
const bigIntToFromBytes = Object.freeze({
  to(num: bigint): Uint8Array {
    if (num < 0) {
      throw new Error('bigIntToFromBytes.to: negative numbers are not supported');
    }

    // Convert the BigInt to string and find the non-zero prefix
    const str = num.toString();
    const nonZeroPrefix = str.replace(/0+$/, '');
    const exponent = str.length - nonZeroPrefix.length;

    // Ensure exponent is in range [0, 255]
    if (exponent > 255) {
      throw new Error('Exponent out of range');
    }

    // Convert non-zero prefix back to BigInt
    const bigInt = BigInt(nonZeroPrefix);

    // Serialize non-zero prefix to big-endian byte array
    const byteArray: number[] = [];
    let tempBigInt = bigInt;
    while (tempBigInt > 0) {
      const byte = Number(tempBigInt & BigInt(0xFF));
      byteArray.unshift(byte);
      tempBigInt >>= BigInt(8);
    }

    // Append exponent byte
    byteArray.push(exponent);

    return new Uint8Array(byteArray);
  },
  from(bytes: Uint8Array): bigint {
    if (bytes.length < 1) throw new Error('bigIntToFromBytes.from: bytes length must be at least 1 to encode exponent');
    // Extract the exponent from the last byte
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know bytes.length > 0
    const exponent = bytes[bytes.length - 1]!;

    // Calculate the BigInt from the remaining bytes
    let bigInt = BigInt(0);
    for (let i = 0; i < bytes.length - 1; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- here we know bytes[i] exists
      bigInt = (bigInt << BigInt(8)) + BigInt(bytes[i]!);
    }

    // Reconstruct the original BigInt by appending zeros based on the exponent
    return BigInt(`${bigInt.toString()}${'0'.repeat(exponent)}`);
  }
});

// *************************************************
// BEGIN -- tests for bigIntToFromBytes
// *************************************************

// const runBigIntTest = (testName: string, expected: string, actual: string) => {
//   const passed = expected === actual;
//   console.log(`Test ${passed ? 'passed' : 'failed'}: ${testName}, expected: ${expected}, actual: ${actual}`);
// };

// const testBigIntConversion = (num: bigint) => {
//   try {
//     const bytes = bigIntToFromBytes.to(num);
//     const result = bigIntToFromBytes.from(bytes);
//     runBigIntTest(`Convert ${num}`, num.toString(), result.toString());
//   } catch (error) {
//     console.error(`Test failed for ${num}`, error);
//   }
// };

// // Test for zero
// testBigIntConversion(0n);

// // Test for small numbers with zero padding
// testBigIntConversion(BigInt('1' + '0'.repeat(10)));
// testBigIntConversion(BigInt('12' + '0'.repeat(20)));

// // Test positive numbers
// testBigIntConversion(123456789n);
// testBigIntConversion(1n);
// testBigIntConversion(0n);
// testBigIntConversion(1000000000000000000n); // Large number
// testBigIntConversion(999999999999999999n);  // Large number with non-zero digits
// testBigIntConversion(100000000000034400000000n); // Large number
// testBigIntConversion(100000000000034400000005n); // Large number
// testBigIntConversion(10000000000003440000000333500n); // Large number
// testBigIntConversion(0x00010000000000003440000000333500n); // Large number


// // Test edge cases
// try {
//   bigIntToFromBytes.to(BigInt(-1)); // Negative number test
//   console.log('Test failed: negative number, expected: error, actual: no error');
// } catch (e) {
//   console.log('Test passed: negative number');
// }

// // Test for the upper limit of the exponent (255)
// const largeNumberWithZeros = BigInt(`1${'0'.repeat(255)}`);
// testBigIntConversion(largeNumberWithZeros);

// // Test exceeding the exponent limit (should throw an error)
// try {
//   const tooLargeNumberWithZeros = BigInt(`1${'0'.repeat(256)}`);
//   bigIntToFromBytes.to(tooLargeNumberWithZeros);
//   console.log('Test failed: Exponent limit exceeded, expected: error, actual: no error');
// } catch (e) {
//   console.log('Test passed: Exponent limit exceeded');
// }

// // Test for a number with leading zeros that would be lost in serialization
// const numberWithLeadingZeros = BigInt('0x0001' + '0'.repeat(10));
// testBigIntConversion(numberWithLeadingZeros);

// // Test for a large number with leading zeros
// const largeNumberWithLeadingZeros = BigInt('0x000123456789ABCDEF' + '0'.repeat(10));
// testBigIntConversion(largeNumberWithLeadingZeros);


// // Fuzz Testing
// const runFuzzTest = (numTests: number) => {
//   for (let i = 0; i < numTests; i++) {
//     const randomNum = BigInt(Math.floor(Math.random() * 1e9));
//     testBigIntConversion(randomNum);
//   }
// };
// runFuzzTest(100);

// // Fuzz testing with random numbers and random zero padding
// const runFuzzTestWithZeros = (numTests: number) => {
//   for (let i = 0; i < numTests; i++) {
//     const randomNum = BigInt(Math.floor(Math.random() * 1e9));
//     const zeros = '0'.repeat(Math.floor(Math.random() * 256));
//     const numWithZeros = BigInt(`${randomNum}${zeros}`);
//     testBigIntConversion(numWithZeros);
//   }
// };
// runFuzzTestWithZeros(100);

// *************************************************
// END -- tests for bigIntToFromBytes
// *************************************************

// uint32NumbersToFromUint8Array is a serialization helper API that
// converts an array of uint32 numbers to and from a big-endian packed
// Uint8Array. The encoding uses 4 bits per digit. The idea behind the
// encoding is to flatten the input array into a stream of digits 0-9
// and use the number 10 as a delimiter to indicate a break between
// array items. The flattened digits+delimeter then has an alphabet of
// size 11 (ie. 0-10), and we can model an alphabet of size 11 into a
// 4-bit encoding (2^4 = 16 >= 11). This results in a shorter binary
// serialization when the input numbers have an average length <=6
// digits (6 digits * 4 bits per digit + 4 bits for delimiter = 28 bits,
// which is less than 32 bits = 4 bytes for an encoding that uses 4
// bytes flat per uint32). Currently, this encoder is used only for
// chainIds, and today, most chainIds are much shorter than 6 digits, so
// today, this encoder results in shorter binary serializations on
// average than 4 bytes flat per uint32.
const uint32NumbersToFromUint8Array = Object.freeze({
  //  Design note: instead of a flat 4 bits per digit, it's possible to construct a complex encoding that is significantly more efficient for input arrays where the total number digits (including delimeters between numbers) is greater than ~21. The way it works is, the input alphabet is [0-9 ] (ten digits plus a delimeter) which is 11 alphabet chars, which means every two characters of digit input takes (11 * 11 = 121) possibilities. 7 bits gives 124 possibilities, leaving 3 possibilities unused. A single alphabet char requires log_2(11) = ~3.5 bits to represent. 3 possibilities unused = ~1.58 bits. So we need an extra ceil(3.5 bits / 1.58) = 3 bits to reach ~3.5 bits to model a single alphabet char. So, every two alphabet chars of input takes 7 bits, and the last odd character takes 10 bits because the presence of a single character is indicated by the last 3 possibilities in 7 bits + next 3 bits. Curiously, this means that an input of length 2N takes 3 bits less than an input of length 2N-1. In this scheme, every character takes 3.5 bits except the last odd character takes 10 bits, resulting in smaller savings for any even-length input of alphabet chars and smaller savings for odd-length inputs above length ~21. NB the distinction between the input numbers list (eg. chainIds [124,955]) vs input alphabet array which is a list of digits in the input using 10 as a delimeter (eg. [1,2,4,10,9,5,5]). --> the reason I didn't go with this scheme now is because it is significantly more complex and results in longer serializations for small odd-length alphabet arrays, and I think a lot of our chainId lists will be small to start. This is something to consider for the next major version of our protobuf type.
  to(ns: number[]): Uint8Array {
    if (ns.some(num => num < 0 || !Number.isInteger(num))) throw new Error("uint32NumbersToFromUint8Array.to: all numbers weren't non-negative integers " + JSON.stringify(ns));

    const alphabetArray: number[] = [];
    for (const num of ns) {
      const digits = num.toString().split('').map((digit) => parseInt(digit, 10));
      if (alphabetArray.length > 0) alphabetArray.push(10); // delimiter
      alphabetArray.push(...digits);
    }

    const buffer: number[] = [];
    for (const code of alphabetArray) buffer.push(code);

    return new Uint8Array(buffer);
  },
  from(bytes: Uint8Array): number[] {
    const alphabetArray: number[] = Array.from(bytes);

    const numbers: number[] = [];
    let currentNum = '';

    for (const digit of alphabetArray) {
      if (digit === 10) { // delimiter
        if (currentNum !== '') {
          numbers.push(parseInt(currentNum, 10));
          currentNum = '';
        }
      } else currentNum += digit.toString();
    }

    if (currentNum !== '') numbers.push(parseInt(currentNum, 10));

    return numbers;
  },
});

// *************************************************
// BEGIN -- tests for uint32NumbersToFromUint8Array
// *************************************************

// const runTest = (testName: string, expected: number[], actual: number[]) => {
//   const passed: boolean = JSON.stringify(expected) === JSON.stringify(actual);
//   if (!passed) console.log(`test ${passed ? 'passed' : 'failed'}: ${testName}, expected: ${JSON.stringify(expected)}, actual: ${JSON.stringify(actual)}, bytes: ${uint32NumbersToFromUint8Array.to(expected)}, bytes length: ${uint32NumbersToFromUint8Array.to(expected).length}`);
// };

// runTest('basic', [1, 2, 3], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 2, 3])));
// runTest('empty array', [], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([])));
// runTest('single zero', [0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0])));
// runTest('single digit', [9], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([9])));
// runTest('single digit with extra zero on it', [90], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([90])));
// runTest('two digits', [10], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([10])));
// runTest('multiple two digits', [10, 20], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([10, 20])));
// runTest('three digits', [100], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([100])));
// runTest('mixed digits', [1, 10], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 10])));
// runTest('mixed digits reversed', [10, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([10, 1])));

// try {
//   uint32NumbersToFromUint8Array.to([-1]);
//   console.log('test failed: negative number, expected: error, actual: no error');
// } catch (e) {
//   // console.log('test passed: negative number');
// }

// try {
//   uint32NumbersToFromUint8Array.to([0.5]);
//   console.log('test failed: non-integer, expected: error, actual: no error');
// } catch (e) {
//   // console.log('test passed: non-integer');
// }

// // Real-world test cases
// runTest('real-world chain IDs', [42161, 324, 1101, 42170, 10], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([42161, 324, 1101, 42170, 10])));
// runTest('single real-world chain ID', [42161], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([42161])));
// runTest('mixed real-world and small chain ID', [42161, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([42161, 1])));
// runTest('mixed small and real-world chain ID', [1, 42161], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 42161])));
// runTest('two real-world chain IDs', [42000, 42161], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([42000, 42161])));

// // Additional test cases
// runTest('odd-length array with odd numbers', [1, 3, 5], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 3, 5])));
// runTest('even-length array with odd numbers', [1, 3, 5, 7], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 3, 5, 7])));
// runTest('odd-length array with even numbers', [2, 4, 6], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([2, 4, 6])));
// runTest('even-length array with even numbers', [2, 4, 6, 8], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([2, 4, 6, 8])));
// runTest('long numbers', [10000, 20000], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([10000, 20000])));
// runTest('short numbers', [1, 2], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 2])));
// runTest('mix of long and short numbers', [1, 10000], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 10000])));
// runTest('many zeroes', [0, 0, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 0, 0])));
// runTest('duplicate numbers', [1, 1, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 1, 1])));
// runTest('duplicate zeroes', [0, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 0])));
// runTest('odd-length array with many zeroes', [0, 0, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 0, 0])));
// runTest('even-length array with many zeroes', [0, 0, 0, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 0, 0, 0])));
// runTest('odd-length array with mix of zeroes and numbers', [0, 1, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 1, 0])));
// runTest('even-length array with mix of zeroes and numbers', [0, 1, 0, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 1, 0, 1])));
// runTest('mix of all', [0, 1, 10000, 2, 3], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 1, 10000, 2, 3])));
// runTest('single long number', [99999], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([99999])));
// runTest('single short number', [9], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([9])));
// runTest('odd-length array with duplicate numbers', [1, 1, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 1, 1])));
// runTest('even-length array with duplicate numbers', [1, 1, 1, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 1, 1, 1])));
// runTest('odd-length array with long and short numbers', [9, 99999, 9], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([9, 99999, 9])));
// runTest('even-length array with long and short numbers', [9, 99999, 9, 99999], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([9, 99999, 9, 99999])));
// runTest('odd-length array with zeroes and duplicate numbers', [0, 1, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 1, 1])));

// // Additional test cases with varied large numbers
// runTest('single varied large number', [123456789], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([123456789])));
// runTest('mixed varied large and small numbers', [123456789, 1], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([123456789, 1])));
// runTest('multiple varied large numbers', [123456789, 987654321], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([123456789, 987654321])));
// runTest('varied large numbers with zeroes', [0, 123456789], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 123456789])));
// runTest('varied large numbers with duplicate small numbers', [1, 1, 123456789], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 1, 123456789])));
// runTest('varied large numbers with even numbers', [2, 4, 123456789], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([2, 4, 123456789])));
// runTest('varied large numbers with odd numbers', [1, 3, 123456789], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 3, 123456789])));
// runTest('odd-length array with varied large numbers', [123456789, 987654321, 111111111], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([123456789, 987654321, 111111111])));
// runTest('even-length array with varied large numbers', [123456789, 987654321, 111111111, 222222222], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([123456789, 987654321, 111111111, 222222222])));
// runTest('varied large numbers with long and short', [9, 123456789, 999999999], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([9, 123456789, 999999999])));
// runTest('varied large numbers with duplicates', [123456789, 123456789], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([123456789, 123456789])));
// runTest('varied large numbers with zeroes and duplicates', [0, 123456789, 123456789], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 123456789, 123456789])));
// runTest('complex mix', [0, 1, 9, 10, 100, 123456789, 987654321], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 1, 9, 10, 100, 123456789, 987654321])));

// runTest('two-digit last number 1', [1, 10], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 10])));
// runTest('two-digit last number 2', [2, 10], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([2, 10])));
// runTest('single two-digit last number', [10], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([10])));
// runTest('two-digit last number with odd first', [3, 11], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([3, 11])));
// runTest('two-digit last number with even first', [4, 12], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([4, 12])));
// runTest('two-digit last number with multiple numbers', [5, 9, 13], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([5, 9, 13])));
// runTest('single two-digit last number in teens', [14], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([14])));
// runTest('two-digit last number with zero first', [0, 15], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 15])));
// runTest('single two-digit last number above teens', [16], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([16])));
// runTest('two-digit last number with seven first', [7, 17], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([7, 17])));

// runTest('two-digit last number 1 with extra zero', [1, 10, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 10, 0])));
// runTest('two-digit last number 2 with extra zero', [2, 10, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([2, 10, 0])));
// runTest('single two-digit last number with extra zero', [10, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([10, 0])));
// runTest('two-digit last number with odd first with extra zero', [3, 11, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([3, 11, 0])));
// runTest('two-digit last number with even first with extra zero', [4, 12, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([4, 12, 0])));
// runTest('two-digit last number with multiple numbers with extra zero', [5, 9, 13, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([5, 9, 13, 0])));
// runTest('single two-digit last number in teens with extra zero', [14, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([14, 0])));
// runTest('two-digit last number with zero first with extra zero', [0, 15, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([0, 15, 0])));
// runTest('single two-digit last number above teens with extra zero', [16, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([16, 0])));
// runTest('two-digit last number with seven first with extra zero', [7, 17, 0], uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([7, 17, 0])));

// const runFuzzTest = (numTests: number) => {
//   for (let i = 0; i < numTests; i++) {
//     const arrLength = Math.floor(Math.random() * 20); // random array length up to 20
//     const randomNumbers = Array.from({ length: arrLength }, () => Math.floor(Math.random() * 1e9)); // random numbers up to 1e9
//     const testName = `Fuzz Test ${i + 1}: ${JSON.stringify(randomNumbers)}`;
//     runTest(testName, randomNumbers, uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to(randomNumbers)));
//   }
// };
// runFuzzTest(10000);

// console.log("numbersToUint8Array uint8ArrayToNumbers test", uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])));
// console.log("numbersToUint8Array uint8ArrayToNumbers test2", uint32NumbersToFromUint8Array.from(uint32NumbersToFromUint8Array.to(allSupportedChainIds)), allSupportedChainIds);

// *************************************************
// END -- tests for uint32NumbersToFromUint8Array
// *************************************************
