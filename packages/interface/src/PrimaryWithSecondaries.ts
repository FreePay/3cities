
// PrimaryWithSecondaries enables the conceptual partitioning of a
// Set<K> into a required primary element and an optional prioritized
// list of secondaries. For example, given
// PrimaryWithSecondaries<LogicalAssetTicker>, the primary could be the
// ticker for the logical asset in which a payment is denominated, and
// the secondaries could be a prioritized list of tickers for other
// logical assets accepted for payment.
export class PrimaryWithSecondaries<K extends PropertyKey> {
  private readonly _primary: K;
  private readonly _secondaries: readonly K[];

  constructor(primary: K, secondaries: readonly K[] = []) {
    if (new Set([primary, ...secondaries]).size !== 1 + secondaries.length) throw new Error(`PrimaryWithSecondaries: primary and secondaries must be unique ${String(primary)} ${secondaries}`);
    this._primary = primary;
    this._secondaries = Object.freeze([...secondaries]); // create a frozen copy of the secondaries array so that the internal secondaries can't be modified via the client's reference to passed secondaries or secondaries()
  }

  get primary(): K {
    return this._primary;
  }

  get secondaries(): readonly K[] {
    return this._secondaries;
  }
}
