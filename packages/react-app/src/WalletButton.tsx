import { shortenAddress, useEthers, useLookupAddress } from "@usedapp/core";
import React, { useEffect, useState } from "react";

// TODO replace WalletButton with RainbowKit. This first requires rewriting our usedappConfig to instead use wagmi's chain management. When adopting rainbowkit, we may have two options, 1) drop usedapp entirely and switch to wagmi when we add rainbowkit, 2) run usedapp side-by-side wagmi with some kind of dual config/compatability between them

type Props = {
  className: string // className to apply to wallet button div
  connectWalletText?: string // text display instead of "Connect Wallet"
};

export const WalletButton: React.FC<Props> = ({ className, connectWalletText }) => {
  const [rendered, setRendered] = useState("");

  const { account, activateBrowserWallet, deactivate, error } = useEthers();

  // TODO there is a "bug" in useLookAddress, or maybe a feature depending on your perspective, where it attempts to look up the ENS address using the wallet's active network. This means that if your address has a primary ENS name set on mainnet, it won't be properly detected and loaded unless your wallet network is set to mainnet. But we want to make an app that always works the same way regardless of which network your wallet is connected to --> implement our own useEnsAddress(address) hook which always looks up the reverse address on mainnet if isProduction, and if !isProduction always look up reverse address on ENS Goerli https://docs.ens.domains/ens-deployments --> I think wagmi always resolves ens addresses against mainnet even if your wallet is set to a different network, obviating this issue after we switch to wagmi
  const { ens, error: ensErr } = useLookupAddress(account);

  useEffect(() => {
    if (account && ens) { // here we must also check `account` because there seems to be a bug in useLookupAddress() where it doesn't properly clear the returned `ens` after disconnecting the wallet, so if we don't check account, we'll `setRendered(non-empty ens)` while wallet is disconnected
      setRendered(ens);
    } else if (account) {
      setRendered(shortenAddress(account));
    } else {
      setRendered("");
    }
  }, [account, ens, setRendered]);

  useEffect(() => {
    if (error) {
      console.error("Error while connecting wallet:", error.message);
    }
  }, [error]);

  useEffect(() => {
    if (ensErr) {
      console.error("WalletButton: error fetching ens. Account", account, 'ens fetch error:', ensErr.message);
    }
  }, [account, ensErr]);

  return (
    <div className={className} onClick={() => {
      if (!account) {
        activateBrowserWallet();
      } else {
        deactivate();
      }
    }}
    >
      {rendered === "" && (connectWalletText || "Connect Wallet")}
      {rendered !== "" && rendered}
    </div>
  );
}
