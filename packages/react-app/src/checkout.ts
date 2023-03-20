import { ProposedAgreement } from "./agreements"
import { StrategyPreferences } from "./StrategyPreferences";

// TODO s/checkout.ts/Checkout.ts

// Checkout is a container type for all data required to create a
// single checkout context. Ie. given a Checkout, a fresh page load
// should have all the data sufficient to reconstruct a checkout
// context so that a buyer/transactor can complete a
// purchase/transaction/agreement.
export type Checkout = {
  proposedAgreement: ProposedAgreement; // the proposed agreement that will be refined into a (non-proposed) agreement and then executed during this checkout session
  strategyPreferences: StrategyPreferences; // the agreement execution strategy preferences to be applied to this checkout, eg. the seller's strategy preferences
}
