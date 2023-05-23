import { Signer } from '@ethersproject/abstract-signer';
import { isAddress } from "@ethersproject/address";
import { MockConnector } from '@wagmi/core/connectors/mock';
import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { ActiveDemoAccountContext } from './ActiveDemoAccountContext';
import { useEnsAddress } from './useEnsAddress';

// tests
//   real address or mock already connected -> invalid mock address -> the invalid mock address fails connectAsync and real address stays connected
//   go from no address -> mock address
//   mock address -> disconnect mock and connect real wallet
//   mock address -> disconnect mock -> change mock address -> new mock address connects
//   mock address -> no mock address
//   mock adddress -> change to invalid mock address -> change to valid mock address
//   mock address -> change mock address

class ReadonlySigner extends Signer {
  signMessage(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  signTransaction(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  connect(): Signer {
    return new ReadonlySigner(this.address);
  }

  readonly address;

  constructor(address: string) {
    super();
    this.address = address;
  }

  getAddress() {
    return Promise.resolve(this.address);
  }
}

// useMockConnectedAddress sets the connected wallet address to the
// passed mockAddressOrENS. This allows the connected address to be
// overridden for demo purposes on a read-only basis (the mocked address
// will not be able to sign any transactions as it has no private key).
// Pass undefined or the empty string to skip mocking.
function useMockConnectedAddress(mockAddressOrENS?: string | undefined): undefined | 'mockAddressSuccessfullyConnected' {
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { address, isConnecting, isReconnecting, isDisconnected } = useAccount();

  const mockEnsName: string | undefined = !mockAddressOrENS || isAddress(mockAddressOrENS) ? undefined : mockAddressOrENS;
  const { address: addressFromENS } = useEnsAddress(mockEnsName);

  const [doConnectThunk, setDoConnectThunk] = useState<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (doConnectThunk) {
      doConnectThunk();
      setDoConnectThunk(undefined);
    }
  }, [doConnectThunk, setDoConnectThunk]);

  const [mockAddressConnectionStatus, setMockAddressConnectionStatus] = useState<'disconnected' | 'disconnecting' | 'connected' | 'connecting' | 'error'>('disconnected');

  useEffect(() => {
    if (mockAddressConnectionStatus === 'error') setMockAddressConnectionStatus('disconnected');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- normally, the error status is unrecoverable, which prevents infinite connection retry loops. However, iff the requested mock address changes, we'll forgive the error status.
  }, [mockAddressOrENS]);

  useEffect(() => {
    const addressToConnect = isAddress(mockAddressOrENS || '') ? mockAddressOrENS : addressFromENS;
    if (isConnecting || isReconnecting) {
      // wagmi is busy connecting or reconnecting to some address. We'll wait until it finishes and then update our state machine from there.
    } else if (
      // check to see if we need to disconnect a previously-connected mock address:
      mockAddressOrENS === undefined // client requested no mock address, so if there's a previously-connected mock address, we'll need to disconnect it.
      || (addressToConnect && mockAddressConnectionStatus === 'connected' && address !== addressToConnect) // the client has requested as mock address, but we're already connected to a different mock address, so we'll need to disconnect it.
    ) {
      if (mockAddressConnectionStatus === 'connecting' || mockAddressConnectionStatus === 'connected') {
        setMockAddressConnectionStatus('disconnecting');
        disconnectAsync().then(() => setMockAddressConnectionStatus('disconnected')).catch((e) => {
          console.error("useMockConnectedAddress: disconnectAsync error when disconnecting previously-connected mock address", e)
          setMockAddressConnectionStatus('error');
        });
      }
    } else if (addressToConnect && mockAddressConnectionStatus === 'disconnected') { // NB addressToConnect can be undefined even if the client requested an address to mock if the client requested by ENS and the ENS resolution is still loading.
      // Client's requested mock address is ready to connect, and our mock connection system is disconnected, so we'll try to connect it. NB here we ignore any currently-connected address, for two reasons: 1) if we were to first try to explicitly disconnect a currently-connected address before connecting to the mock address, then wagmi's auto-reconnect functionality can cause an infinite loop of reconnect attempts to this currently-connected address (this was observed during development), 2) and it works: wagmi is designed to accept our connection attempt as an override to whatever other address might be already connected or conecting.
      setMockAddressConnectionStatus('connecting');
      setDoConnectThunk(() => () => { // NB here we need to wrap the thunk value in an outer function to actually cause the value to be set to the thunk, otherwise the thunk is interpreted as a setter function and the connectAsync is incorrectly executed as part of the state update instead of correctly in the doConnectThunk effect.
        connectAsync({
          connector: new MockConnector({
            options: {
              signer: new ReadonlySigner(addressToConnect),
            },
          })
        }).then(({ account: connectedToAccount }) => {
          if (connectedToAccount === addressToConnect) setMockAddressConnectionStatus('connected');
          else throw new Error(`useMockConnectedAddress: connectAsync: connected to an unexpected account ${connectedToAccount} != addressToConnect ${addressToConnect}`);
        }).catch((e: unknown) => {
          setMockAddressConnectionStatus('error');
          console.error("useMockConnectedAddress: connect error", e, "mockAddressOrENS", mockAddressOrENS, "addressToConnect", addressToConnect);
        });
      });
    }
  }, [connectAsync, disconnectAsync, address, mockAddressOrENS, addressFromENS, mockAddressConnectionStatus, setMockAddressConnectionStatus, isConnecting, isReconnecting, isDisconnected, setDoConnectThunk]);

  return mockAddressConnectionStatus === 'connected' ? 'mockAddressSuccessfullyConnected' : undefined;
}

interface MockConnectedAddressProps {
  children?: React.ReactNode;
}

const demoAccountSearchParam = "demoAccount";

export const UseDemoAccount: React.FC<MockConnectedAddressProps> = ({ children }) => {
  const [searchParams] = useSearchParams();
  const [shouldConnectToDemoAccount, setShouldConnectToDemoAccount] = useState<boolean>(true); // when the page loads, we'll connect to any demo account requested by the client via URL search param, overriding any other (re)connected account. We want the user to be able to disconnect any demo account and connect their own account, so we'll use shouldConnectToDemoAccount to track disconnection of the demo account and never reconnect it. If the demo account is disconnected, the user must reload the page to reconnect it. We don't want to modify the URL search params because we want to preserve the demo account in case the page is reloaded or link is shared.

  const rawDemoAccountSearchParam = searchParams.get(demoAccountSearchParam); // make this into a local variable to satisfy linter
  useEffect(() => {
    if (!shouldConnectToDemoAccount) setShouldConnectToDemoAccount(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- here we want to always connect to the new demo account after the user updates the demo account URL search param. If the user disconnects the demo account, and then later updates the demo account, this effect ensures the new demo account is connected.
  }, [rawDemoAccountSearchParam]);

  const demoAccountToConnect: string | undefined = (shouldConnectToDemoAccount && searchParams.get(demoAccountSearchParam)) || undefined;

  const demoAccountSuccessfullyConnected: boolean = Boolean(useMockConnectedAddress(demoAccountToConnect));

  const [demoAccountThatWasSuccessfullyConnected, setDemoAccountThatwasSuccessfullyConnected] = useState<string | undefined>(undefined); // used to cache demoAccountToConnect upon successful connection, so that we can keep track of avoiding reconnecting to a disconnected demo account vs. URL search param changes that indicate the user is requesting a change of the demo account.

  useEffect(() => { // here we cache the successfully connected demo account to help us keep track of avoiding reconnecting to a disconnected demo account vs. URL search param changes that indicate the user is requesting a change of the demo account.
    if (demoAccountSuccessfullyConnected) setDemoAccountThatwasSuccessfullyConnected(demoAccountToConnect);
  }, [demoAccountToConnect, demoAccountSuccessfullyConnected, setDemoAccountThatwasSuccessfullyConnected]);

  const onDisconnect = useCallback(() => {
    if (demoAccountSuccessfullyConnected) {
      if (demoAccountThatWasSuccessfullyConnected === demoAccountToConnect) setShouldConnectToDemoAccount(false); // demo account never changed and was previously successfully connected and now disconnected. We'll never reconnect it.
      else {
        // the demo account changed while it was connected (as detected by the new value of demoAccountToConnect), so we'll assume the user intentionally changed the URL search param and that's what triggered this disconnection. This is a no-op, and the new demo account will subsequently be connected.
      }
    }
    else {
      // no-op: a disconnection occurred unrelated to any demo account.
    }
  }, [demoAccountToConnect, setShouldConnectToDemoAccount, demoAccountSuccessfullyConnected, demoAccountThatWasSuccessfullyConnected]);
  useAccount({ onDisconnect });

  return <ActiveDemoAccountContext.Provider value={demoAccountSuccessfullyConnected && rawDemoAccountSearchParam ? rawDemoAccountSearchParam : undefined}>
    {children}
  </ActiveDemoAccountContext.Provider>
}
