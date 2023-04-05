import React, { useEffect, useState } from "react";
import CurrencyInput from 'react-currency-input-field';
import { useImmer } from 'use-immer';
import { useAccount } from "wagmi";
import { ReceiverProposedPayment } from "./agreements";
import { allSupportedChainIds, getSupportedChainName } from "./chains";
import { Checkout } from './checkout';
import { LogicalAssetTicker, parseLogicalAssetAmount } from "./logicalAssets";
import { StrategyPreferences } from "./StrategyPreferences";
import { allTokenTickers } from "./tokens";

// Here we implement a synthetic router to build a Checkout in a
// series of small UI steps. These steps are currently hardcoded to
// build a Checkout where the Agreement is a ReceivedProposedPayment.

type CheckoutStep1Result = Pick<ReceiverProposedPayment, 'logicalAssetTicker' | 'amountAsBigNumberHexString' | 'note'>

export const CheckoutStep1: React.FC<{ setResult: (r: CheckoutStep1Result) => void }> = ({ setResult }) => {
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [note, setNote] = useState<string>('');

  const isSubmitButtonDisabled: boolean = amount === undefined;

  return <form className="flex w-full flex-col items-center gap-5">
    <div className="flex w-full items-center gap-5">
      <div className="flex w-1/3 flex-col">
        <label className="mb-1.5 text-sm font-medium text-neutral-600" htmlFor="amount">Amount</label>
        <CurrencyInput
          className="w-full rounded-md border px-3.5 py-2"
          id="amount"
          name="amount"
          placeholder="how much?"
          prefix="$"
          allowNegativeValue={false}
          defaultValue={0}
          decimalsLimit={2}
          onValueChange={(vs) => {
            if (vs === undefined) setAmount(undefined)
            else try {
              const v = parseFloat(vs);
              if (v > 0) setAmount(v);
              else setAmount(undefined);
            } catch (err) {
              console.warn(err);
            }
          }}
        />
      </div>
      <div className="flex w-2/3 flex-col">
        <label
          className="mb-1.5 text-sm font-medium text-neutral-600"
          htmlFor="note"
        >
          For what?
        </label>
        <input className="w-full rounded-md border px-3.5 py-2" id="note" type="text" placeholder="(optional)" onChange={(e) => setNote(e.target.value)} value={note}></input>
      </div>
    </div>
    <button className="w-full rounded-md bg-gradient-to-br from-violet-500 to-blue-500 px-3.5 py-2 text-sm font-medium text-white transition hover:hue-rotate-30 active:scale-95 active:hue-rotate-60 disabled:opacity-50" onClick={() => {
      if (amount !== undefined) {
        const p = {
          logicalAssetTicker: 'USD' as LogicalAssetTicker, // TODO support ETH
          amountAsBigNumberHexString: parseLogicalAssetAmount(amount.toString()).toHexString(),
        };
        setResult(note === '' ? p : Object.assign({ note }, p));
      }
    }} disabled={isSubmitButtonDisabled}>Request</button>
  </form>;
}

type CheckoutStep2Result = StrategyPreferences

export const CheckoutStep2: React.FC<{ setResult: (r: CheckoutStep2Result) => void }> = ({ setResult }) => {
  const [sp, setSp] = useImmer<StrategyPreferences>({});

  const toggleTokenTicker = (tt: string) => {
    setSp(draft => {
      if (draft.tokenTickerExclusions === undefined) draft.tokenTickerExclusions = [tt];
      else {
        const i = draft.tokenTickerExclusions.indexOf(tt);
        if (i > -1) draft.tokenTickerExclusions.splice(i, 1);
        else draft.tokenTickerExclusions.push(tt);
      }
    });
  }

  const toggleChainId = (cid: number) => {
    setSp(draft => {
      if (draft.chainIdExclusions === undefined) draft.chainIdExclusions = [cid];
      else {
        const i = draft.chainIdExclusions.indexOf(cid);
        if (i > -1) draft.chainIdExclusions.splice(i, 1);
        else draft.chainIdExclusions.push(cid);
      }
    });
  }

  // TODO delegate to StrategyPreferencesEditor
  // TODO disable submit button if no tokens or no chains are selected
  return <div className="space-y-5">
    <div>
      <h3 className="mb-1.5 text-sm text-neutral-600 font-medium">
        Accepting these tokens:
      </h3>
      <div className="flex flex-wrap gap-2.5">
        {allTokenTickers.map(tt => <div key={tt}><button className="font-medium px-3.5 py-2 border rounded-md inline-flex justify-start hover:border-gray-300 focus:border-white focus:bg-gradient-to-br focus:from-violet-500 focus:to-blue-500 focus:text-white" onClick={toggleTokenTicker.bind(null, tt)}>{sp.tokenTickerExclusions !== undefined && sp.tokenTickerExclusions.indexOf(tt) > -1 && 'no '}{tt}</button></div>)}
      </div>
    </div>
    <div>
      <h3 className="mb-1.5 text-sm text-neutral-600 font-medium">
        On these chains:
      </h3>
      <div className="flex flex-wrap gap-2.5">
        {allSupportedChainIds.map(cid => <div key={cid}><button className="font-medium px-3.5 py-2 border rounded-md inline-flex justify-start hover:border-gray-300 focus:border-white focus:bg-gradient-to-br focus:from-violet-500 focus:to-blue-500 focus:text-white" onClick={toggleChainId.bind(null, cid)}>{sp.chainIdExclusions !== undefined && sp.chainIdExclusions.indexOf(cid) > -1 && 'no '}{getSupportedChainName(cid)}</button></div>)}
      </div>
    </div>
    <div>
      <h3 className="mb-1.5 text-sm text-neutral-600 font-medium">
        (Click token/chain to disable)
      </h3>
    </div>
    <button className="text-sm font-medium px-3.5 py-2 bg-gradient-to-br from-violet-500 to-blue-500 rounded-md text-white hover:hue-rotate-30 active:hue-rotate-60 transition active:scale-95 w-full" onClick={() => setResult(sp)}>Looks Good</button>
  </div>;
}

type CheckoutStep3Result = string // ie. Payment.toAddress

export const CheckoutStep3: React.FC<{ setResult: (r: CheckoutStep3Result) => void }> = ({ setResult }) => {
  // TODO delegate to AddressPicker reusable component that lets you type in an address, ENS, or connect wallet to provide one
  const { address: connectedWalletAddress } = useAccount();
  const [address, setAddress] = useState<string>(typeof connectedWalletAddress === 'string' ? connectedWalletAddress : '');

  useEffect(() => {
    if (address.length < 1 && typeof connectedWalletAddress === 'string') setAddress(connectedWalletAddress);
  }, [connectedWalletAddress, address, setAddress])


  return <form className="flex w-full flex-col items-center gap-5">
    <div className="flex w-full items-center gap-5">
      <div className="flex flex-col">
        <label className="mb-1.5 text-sm font-medium text-neutral-600" htmlFor="address">Address to receive money (ENS coming soon):</label>
        <input className="w-full rounded-md border px-3.5 py-2" id="address" type="text" placeholder="0x123... or connect wallet" onChange={(e) => setAddress(e.target.value)} value={address}></input>
      </div>
    </div>
    <button className="w-full rounded-md bg-gradient-to-br from-violet-500 to-blue-500 px-3.5 py-2 text-sm font-medium text-white transition hover:hue-rotate-30 active:scale-95 active:hue-rotate-60 disabled:opacity-50" disabled={address.length < 1} onClick={() => { if (address.length > 0) /* TODO address validation, ensure it's at least a well-formed addressed, ENS resolves, etc. */ setResult(address) }}>Done</button>
  </form>;
}

export const CheckoutEditor: React.FC<{ setResult: (r: Checkout) => void }> = ({ setResult }) => {
  const [checkoutStep1Result, setCheckoutStep1Result] = useState<CheckoutStep1Result | undefined>(undefined);
  const [checkoutStep2Result, setCheckoutStep2Result] = useState<CheckoutStep2Result | undefined>(undefined);
  const [checkoutStep3Result, setCheckoutStep3Result] = useState<CheckoutStep3Result | undefined>(undefined);
  useEffect(() => {
    if (checkoutStep1Result !== undefined && checkoutStep2Result !== undefined && checkoutStep3Result !== undefined) {
      const rpp: ReceiverProposedPayment = Object.assign({
        toAddress: checkoutStep3Result,
        _p: false as const,
        _rpp: true as const,
      }, checkoutStep1Result);
      const c: Checkout = {
        proposedAgreement: rpp,
        strategyPreferences: checkoutStep2Result,
      };
      setResult(c);
    }
  }, [checkoutStep1Result, checkoutStep2Result, checkoutStep3Result, setResult]);
  const render = (() => {
    if (checkoutStep1Result === undefined) return <CheckoutStep1 setResult={setCheckoutStep1Result} />;
    else if (checkoutStep2Result === undefined) return <CheckoutStep2 setResult={setCheckoutStep2Result} />;
    else if (checkoutStep3Result === undefined) return <CheckoutStep3 setResult={setCheckoutStep3Result} />
    else return null;
  })();
  return render;
};
