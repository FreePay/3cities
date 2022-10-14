import React, { useEffect, useState } from "react";
import useClipboard from "react-use-clipboard";
import { Checkout } from "./checkout";
import { CheckoutEditor } from "./CheckoutEditor";
import { ContentWrapper } from "./ContentWrapper";
import { serializeToModifiedBase64 } from "./serialize";

// import { useConnectedWalletAddressContext } from "./connectedWalletContextProvider";

// Old imports:
// import { abis, addresses } from "@3cities/contracts";
// import { Contract } from "@ethersproject/contracts";
// import { formatEther } from '@ethersproject/units';
// import { shortenAddress, useCall, useEtherBalance, useEthers, useLookupAddress, useTokenBalance } from "@usedapp/core";
// import React, { useEffect, useState } from "react";
// import { Body, Container, Header } from "./components";
// import useAddressOrENS from "./hooks/useAddressOrENS";
// import { nativeCurrencies, tokens } from "./usedappCurrencies";
// import TokenBalance from "./TokenBalance";
// import { useConnectedWalletAddressContext } from "./connectedWalletContextProvider";

// const Leaf: React.FC = () => {
//   const ac = useConnectedWalletAddressContext();
//   // console.log("Leaf render", ac);
//   let tokensRendered = 0;
//   if (ac === undefined) return null;
//   else return <div>
//     connected address: {ac.address}<br />
//     {allTokenKeys.map(tk => {
//       const tb = ac.tokenBalances[tk];
//       if (tb === undefined) return;
//       else {
//         tokensRendered += 1;
//         return <div key={tk}>
//           <RenderTokenBalance tokenBalance={tb} />
//         </div>;
//       }
//     })}
//     {tokensRendered < 1 && "(no token balances)"}
//   </div>;
// }

// const Intermediate: React.FC = () => {
// const [num, setNum] = useState(0);
// useEffect(() => {
//   const intervalId = setInterval(() => {
//     setNum(n => n + 1);
//   }, 10000);
//   return () => clearInterval(intervalId);
// }, [setNum]);
// console.log("Intermediate render", num);
// return <div>
// {/*num % 2 === 0 &&*/ <Leaf /> /* here we flicker Leaf in and out of existence to test subscription clearing on unmount */}
// </div>;
// }

// const testCheckout: Checkout = {
//   proposedAgreement: {
//     toAddress: '0xac0d7753EA2816501b57fae9ad665739018384b3',
//     logicalAssetTicker: 'USD',
//     amountAsBigNumberHexString: parseLogicalAssetAmount("30.12").toHexString(),
//     _p: false,
//     _rpp: true,
//   },
//   strategyPreferences: {
//     tokenTickerExclusions: ['USDC'],
//     chainIdExclusions: [42],
//   },
// };

// function ProposedStrategyTest() {
//   const pss = getProposedStrategiesForProposedAgreement(testCheckout.strategyPreferences, testCheckout.proposedAgreement);
//   if (pss.length < 1) return <div>(no proposed strategies)</div>;
//   else return <div>
//     proposed strategies:
//     {pss.map(ps => <div key={getTokenKey(ps.receiverProposedTokenTransfer.token)}><RenderProposedStrategy ps={ps} /></div>)}
//   </div >;
// }

// function StrategyTest() {
//   const ac = useConnectedWalletAddressContext();
//   if (ac === undefined) return <div>no strategies because no wallet is connected</div>;
//   else if (isReceiverProposedPayment(testCheckout.proposedAgreement)) {
//     const ss = getStrategiesForAgreement(testCheckout.strategyPreferences, acceptReceiverProposedPayment(ac.address, testCheckout.proposedAgreement), ac);
//     if (ss.length < 1) return <div>(no strategies)</div>;
//     else return <div>
//       strategies:
//       {ss.map(s => <div key={getTokenKey(s.tokenTransfer.token)}>
//         <RenderStrategy s={s} />
//       </div>)}
//     </div >;
//   } else return <div>strategy test: unsupported agreement type</div>;
// }

function App() {
  // const maybeAddressOrENS = useAddressOrENS();
  // const firstNativeCurrencyBalance = useEtherBalance(maybeAddressOrENS, { chainId: nativeCurrencies[0].chainId });
  // const firstTokenBalance = useTokenBalance(tokens[0].address, maybeAddressOrENS, { chainId: tokens[0].chainId });
  // console.log('addr', maybeAddressOrENS, 'firstTokenBalance', firstTokenBalance);
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // const ftb = useMemo(() => firstTokenBalance, [firstTokenBalance && firstTokenBalance.toString()]);

  // Read more about useDapp on https://usedapp.io/
  // const { error: contractCallError, value: tokenBalance } =
  //   useCall({
  //     contract: new Contract(addresses.ceaErc20, abis.erc20),
  //     method: "balanceOf",
  //     args: ["0x3f8CB69d9c0ED01923F11c829BaE4D9a4CB6c82C"],
  //   }) ?? {};
  // console.log(contractCallError, tokenBalance);


  // const STAKING_CONTRACT = '0x00000000219ab540356cBB839Cbe05303d7705Fa';
  // const stakingBalance = useEtherBalance(STAKING_CONTRACT);
  // console.log('stakingBalance', stakingBalance && formatEther(stakingBalance));

  const [checkout, setCheckout] = useState<Checkout | undefined>(undefined);
  const [checkoutLink, setCheckoutLink] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (checkout !== undefined) setCheckoutLink(`${location.origin}/#/pay?c=${serializeToModifiedBase64(checkout)}`); // TODO use current domain to build a relative checkout link; react-router may provide utils for this
  }, [checkout, setCheckoutLink]);

  const [isCopied, setCopied] = useClipboard(checkoutLink || '', {
    successDuration: 5000, // `isCopied` will go back to `false` after 5000ms
  });

  return (
    <ContentWrapper heading={checkoutLink === undefined ? "Request Money" : "Share this link to request money:"}>
      {checkout === undefined && <CheckoutEditor setResult={setCheckout} />}
      {checkoutLink !== undefined && <div>
        <div className="flex justify-center">
          <div>
            {navigator.share !== undefined ? <button className="text-4xl w-full rounded-md bg-gradient-to-br from-violet-500 to-blue-500 px-3.5 py-2 font-medium text-white transition hover:hue-rotate-30 active:scale-95 active:hue-rotate-60" onClick={() => {
              navigator.share({ url: checkoutLink })
            }}>
              Share Link
            </button> : <button className="text-4xl w-full rounded-md bg-gradient-to-br from-violet-500 to-blue-500 px-3.5 py-2 font-medium text-white transition hover:hue-rotate-30 active:scale-95 active:hue-rotate-60" onClick={setCopied}>
              {isCopied ? 'Copied' : 'Copy Link'}
            </button>}
          </div>
        </div>
      </div>}
    </ContentWrapper>
  );
}

export default App;
