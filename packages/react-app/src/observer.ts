import { useEffect, useState } from 'react';

// If our needs ever expand and we may then want to consider replacing our homebrew observer with a more fully-featured reactive programming library, the closest facility to our observer that I've seen is a multicasted subject from rxjs https://rxjs.dev/guide/subject

export type SubscriptionOnValueChangeHandler<T> = (t: T) => void;
export type Unsubscribe = () => void;
export interface Subscription<T> {
  unsubscribe: Unsubscribe, // unsubscribe from this subscription, ie. cancel this subscription. For example, a React component that subscribed should call unsubscribe on unmount to avoid memory leaks and pushing future values into the component that unmounted
  initialValue: T // Observer allows subscriptions to synchronous updates of a stream of values of type T, and this stream is memoryless, and so initialValue is the current value of T, and new values will be pushed into the subscription callback
}

// Observer<T> is a facility to subscribe to synchronous updates of a stream of values of type T. See ObservableValue.
export interface Observer<T> {
  subscribe: (s: SubscriptionOnValueChangeHandler<T>) => Subscription<T>, // subscribe to be pushed new values
  isObserver: true, // 
  getCurrentValue: () => T,
}

// isObserver returns a TypeScript type assertion that the passed o is
// an Observer (or not)
export function isObserver<T>(o: T | Observer<T>): o is Observer<T> {
  return o !== null && typeof o === 'object' && ('isObserver' in o) && o['isObserver'] === true;
}

// ObservableValue<T> enables subscriptions to synchronously observe a
// stream of values of type T. ObservableValue is memoryless; only the
// current (latest) value is retained. ObservableValue exposes an
// `observer` which is intended to be passed to any number of clients
// for those clients to then make any number of subscriptions to the
// observer. When a new client subscribes to the observer, if the new
// client wants immediate access to the current value of T, it must be
// queried using `getCurrentValue()` as only future values of T are
// pushed to all client subscriptions. Note that clients are
// responsible for managing their own unsubscriptions. For example, a
// client that's a React component must unsubscribe from the observer
// upon unmounting in order to prevent memory leaks. To construct a
// canonical instance of ObservableValue, use makeObservableValue
// below. The primary use case for ObservableValue is to avoid
// unwanted re-renders of React components because a React component
// re-renders when its props or state are updated, and so if
// mutable/dynamic global state is kept in a root/ancestor React
// component, updates to that state trigger a re-render of the
// component tree, which can cause UI jank. Instead, we can 1)
// construct an ObservableValue as React state in the root/ancestor
// component, 2) pass that ObservableValue to a React leaf node (eg.
// as props or a React.Context) where its dynamic current value may be
// stored as state and safely updated without triggering a cascading
// re-render, and 3) pass the ObservableValue.observer down the
// component tree (eg. as props or a React.Context) where it may then
// be subscribed to by the minimal set of React components which will
// be re-rendered when the dynamic value is updated. NB be aware of
// the potential need for an explicit gc strategy to avoid
// subscription memory leaks in the case where ObservableValue is
// gc'd. There is no mechanism inside ObservableValue to let
// subscriptions know of its own death/it being gc'd. In a React app,
// if an ObservableValue is unmounted, gc'd, and later re-mounted,
// that should automatically trigger to an update inside React to any
// observer passed as props or in a React.Context, and if downstream
// React components/subscriptions are properly unsubscribing on change
// of observer (as is done in useObservedValue), then this should
// avoid memory leaks in the case where ObservableValue is gc'd.
export interface ObservableValue<T> {
  getCurrentValue: () => T, // current value of type T. Must be called by new clients if they want the current value because only new/future values are pushed into the observer subscription callback
  observer: Observer<T>, // Observer to pass to clients who want to subscribe to observe the stream of values of type T. Eg. Observer is passed to React components that will subscribe and re-render when the value is updated. Note that stream of values is memoryless and new client subscriptions can only read the current value and have future values pushed to them; historical values are lost (and gc'ing old values is an important property to avoid memory leaks in a long-running app)
  setValueAndNotifyObservers: (t: T) => void, // update the current value to the passed new value and push this new value to all subscriptions. The current (old) value is discarded
}

// makeObservableValue constructs a canonical instance of
// ObservableValue. See note on ObservableValue.
export function makeObservableValue<T>(initialValue: T): ObservableValue<T> {
  let currentValue = initialValue;
  const subs: Set<SubscriptionOnValueChangeHandler<T>> = new Set();
  const subscribe = (newSub: SubscriptionOnValueChangeHandler<T>) => {
    subs.add(newSub);
    const response: Subscription<T> = {
      initialValue: currentValue,
      unsubscribe: () => subs.delete(newSub),
    }
    return response;
  }
  return {
    getCurrentValue: () => currentValue,
    observer: {
      getCurrentValue: () => currentValue,
      isObserver: true,
      subscribe,
    },
    setValueAndNotifyObservers: (newT: T) => {
      currentValue = newT;
      subs.forEach(s => s(newT));
    },
  };
}

// useObservedValue is a React hook to use an observed value as state.
// useObservedValue automatically handles 1) the distinction between
// reading getCurrentValue() vs. having new values pushed into the
// subscription callback, and 2) unsubscribing on React component
// unmount to avoid memory leaks and updating state on new value push
// after a component is unmounted.
export function useObservedValue<T>(o: Observer<T>): T {
  const [t, setT] = useState(() => o.getCurrentValue());
  useEffect(() => {
    return o.subscribe(setT).unsubscribe;
  }, [o, setT]);
  return t;
}

// mockObserver constructs a mock Observer for testing purposes.
// Useful to construct a value Observer<T> without first constructing
// an outer ObservableValue<T>.
export function mockObserver<T>(t: T): Observer<T> {
  return {
    subscribe: () => {
      return {
        unsubscribe: () => {
          const x = 5;
          console.info("mockObserver unsubscribe no-op", x)
          throw new Error("ran mockObserver unsub");
        }, // console.info prevents tslint error from empty block
        initialValue: t,
      };
    },
    isObserver: true,
    getCurrentValue: () => t,
  };
}
