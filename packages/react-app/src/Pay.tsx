import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { acceptReceiverProposedPayment, isReceiverProposedPayment } from "./agreements";
import { getSupportedChainName } from "./chains";
import { Checkout } from "./checkout";
import { useConnectedWalletAddressContext } from "./connectedWalletContextProvider";
import { ContentWrapper } from "./ContentWrapper";
import { RenderLogicalAssetAmount } from "./RenderLogicalAssetAmount";
import { RenderTokenTransfer } from "./RenderTokenTransfer";
import { deserializeFromModifiedBase64 } from "./serialize";
import { getProposedStrategiesForProposedAgreement, getStrategiesForAgreement, Strategy } from "./strategies";
import { getTokenKey } from "./tokens";
import { ExecuteTokenTransferButton, ExecuteTokenTransferButtonStatus, TransactionFeeUnaffordableError } from "./transactions";
import { useBestStrategy } from "./useBestStrategy";

export const Pay: React.FC = () => {
  const [checkout, setCheckout] = useState<Checkout | undefined>(undefined);

  useEffect(() => {
    const hack = location.hash.substring(location.hash.indexOf('?') + 1); // WARNING HACK TODO here we hardcode queryparam parsing when instead we should use, say, react-router's query param utils
    const q = new URLSearchParams(hack);
    const s = q.get("c");
    if (s !== null) try {
      setCheckout(deserializeFromModifiedBase64(s));
    } catch (e) {
      console.warn(e);
    }
  }, [setCheckout]);

  const ac = useConnectedWalletAddressContext();

  const heading = checkout === undefined || !isReceiverProposedPayment(checkout.proposedAgreement) ? "Invalid Link" : ((checkout.proposedAgreement.note && <span>Pay <RenderLogicalAssetAmount {...checkout.proposedAgreement} /> for {checkout.proposedAgreement.note}</span>) || <span>Pay <RenderLogicalAssetAmount {...checkout.proposedAgreement} /></span>);

  const [status, setStatus] = useState<ExecuteTokenTransferButtonStatus | undefined>(undefined);

  const doReset = useCallback(() => {
    status?.reset();
  }, [status]);

  const retryButton = status?.isError ? <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={doReset}>Retry</button> : undefined; // TODO rm this debug retry button. Instead, the app should provide some convenient fallback in case of a general fatal error (besides merely suggesting the user reload the page, which is a bad experience).

  // TODO when we build the new app route/page architecture, we'll have to figure out the right abstraction boundaries in terms of the pipeline of Checkout -> ac -> strategies -> best/otherStrategies -> pay now button -> menu of backup payment methods. There's a lot of potential ways to slice this, and I'm not sure which might be best. And I don't think a design exercise/study is the right next step... I think the right next step is to design the app launch route/page architecture and then see what pops out, and then do a design study based on that.

  const strategies = useMemo<Strategy[] | undefined>(() => {
    if (checkout !== undefined && ac !== undefined && isReceiverProposedPayment(checkout.proposedAgreement)) return getStrategiesForAgreement(checkout.strategyPreferences, acceptReceiverProposedPayment(ac.address, checkout.proposedAgreement), ac);
    else return undefined;
  }, [checkout, ac]);

  const { bestStrategy, otherStrategies, disableStrategy, selectStrategy } = useBestStrategy(strategies);

  useEffect(() => {
    if (strategies !== undefined && status?.error !== undefined && (status.error instanceof TransactionFeeUnaffordableError)) {
      // here, the user can't afford to pay the transaction fee for the active token transfer, so we'll disable the strategy. We'll also disable all other strategies for the same chainId under the assumption that if the user can't afford this strategy, they can't afford any other strategies on that same chain. WARNING this assumption is untrue in the case where a user can't afford an erc20 transfer but could afford the cheaper native currency transfer.
      strategies.forEach(s => {
        if (s.tokenTransfer.token.chainId === status.activeTokenTransfer.token.chainId) disableStrategy(s);
      });
      if (status.buttonClickedAtLeastOnce) {
        // here we have just disabled a strategy because the user can't afford to pay the transaction fee, but the user also clicked the button for this strategy at least once, so we are removing a strategy they interacted with, so we'll show a helpful indicator to make this less jarring
        toast(<span>Payment method changed:<br />Blockchain fee was unaffordable</span>);
      }
    }
  }, [strategies, disableStrategy, status?.error, status?.activeTokenTransfer, status?.buttonClickedAtLeastOnce]);

  const canSelectNewStrategy: boolean = !( // user may select a new strategy unless...
    (status?.userSignedTransaction // the user signed the transaction
      || status?.userIsSigningTransaction) // or the user is currently signing the transaction
    && !status.isError // and there wasn't an error, then we don't want to let the user select a new strategy because they may broadcast a successful transaction for the current transfer, and that could result in a double-spend for this Agreement (eg. the user selects a new strategy, then signs the transaction for the previous strategy, then signs a transaction for the new strategy, and there's a double spend)
  );

  return (
    <ContentWrapper heading={heading}>
      <div className="flex flex-col gap-5">
        {checkout === undefined && <div>Please ask them for a new link</div>}
        {checkout !== undefined && ac === undefined && <div>
          <br />
          {(() => {
            const pss = getProposedStrategiesForProposedAgreement(checkout.strategyPreferences, checkout.proposedAgreement);
            const allStrategiesTokenTickers: string[] = [... new Set(pss.map(ps => ps.receiverProposedTokenTransfer.token.ticker))];
            const allStrategiesChainIds: number[] = [... new Set(pss.map(ps => ps.receiverProposedTokenTransfer.token.chainId))];
            return <div className="space-y-2.5">
              <h4><span className="font-bold">Tokens Accepted:</span><br />{allStrategiesTokenTickers.join(", ")}</h4>
              <h4><span className="font-bold">Chains Accepted:</span><br />{allStrategiesChainIds.map(getSupportedChainName).join(", ")}</h4>
            </div>;
          })()}
          <br />
        </div>}
        {checkout !== undefined && ac !== undefined && bestStrategy === undefined && <div>
          <br />No payment options for the connected wallet.
          <br /><br />Please disconnect your wallet to see the available tokens and chains.
          {/* TODO here, instead, we should show the available proposed strategies to guide the user towards connecting/funding a wallet to check out successfully */}
        </div>}
        {bestStrategy !== undefined && <div className="grid grid-cols-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 w-full items-center border-b py-4">
            <div className="text-center">
              <RenderTokenTransfer tt={status?.activeTokenTransfer || bestStrategy.tokenTransfer} />
            </div>
            <div className="text-center">
              <ExecuteTokenTransferButton
                tt={bestStrategy.tokenTransfer}
                autoReset={true}
                loadForeverOnTransactionFeeUnaffordableError={true}
                label="Pay Now"
                successLabel="Paid ✅"
                className="rounded-md px-3.5 py-2 font-medium bg-blue-500 hover:bg-blue-600 focus:outline-none active:scale-95 w-full sm:w-64"
                disabledClassName="border-black text-black pointer-events-none"
                enabledClassName="text-white"
                errorClassName="text-red-600"
                warningClassName="text-black"
                loadingSpinnerClassName="text-white"
                setStatus={setStatus}
              />
              {retryButton}
            </div>
          </div>
          <div className="self-center py-4">
            <span>Other payment methods:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {(otherStrategies || []).map((s, i) => <div key={getTokenKey(s.tokenTransfer.token)} className={`p-1 border-t ${i % 2 === 0 ? 'sm:border-r' : ''}`}>
              <span onClick={() => {
                if (canSelectNewStrategy) {
                  selectStrategy(s);
                  // WARNING here we must not call status.reset() because canSelectNewStrategy is intended to be true iff autoReset=true will auto-reset the button. If instead we called reset here, and there was some state inconsistency between our view and the button's view of the transfer, then it's possible that we might reset the button after it's unsafe to do so (eg. when user may sign a tx for the old transfer) and risk causing a double payment.
                }
              }} className={`${canSelectNewStrategy ? 'hover:cursor-pointer' : ''}`}>
                <RenderTokenTransfer tt={s.tokenTransfer} />
              </span>
            </div>)}
          </div>
        </div>}
      </div>
    </ContentWrapper >
  );
} 
