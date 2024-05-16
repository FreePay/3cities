
export const isRunningInAnIframe: boolean = window !== window.parent; // true iff 3cities is running in an iframe

export const isRunningInAStandaloneWindow: boolean = !isRunningInAnIframe; // true iff 3cities is running in a standalone window

// Serializable is the type of values that are serializable with
// window.postMessage, ie. the values that may be passed to a parent
// window via postMessage
type Serializable =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | Date
  | File
  | Blob
  | ArrayBuffer
  | ImageData
  | Serializable[]
  | { [key: string]: Serializable }
  | Map<Serializable, Serializable>
  | Set<Serializable>;

// IframeMessage is our type to which every message passed to the parent
// window via postMessage must conform.
export interface IframeMessage<K extends string> {
  kind: K; // kind is the key on which the parent window must route the message. Below, we assign a helper function to each kind of message. TODO in future, the set of valid message kinds could be unified and made typesafe with the parent window's message receiver by defining them as a protobuf enum which can then be consumed here and in the parent window's message receiver
  [key: string]: Serializable;
}

// notifyParentWindowOfSuccessfulCheckout notifies the parent window of
// a successful checkout. Any additional checkout data that may be
// included in the message are anonymous to this function.
export function notifyParentWindowOfSuccessfulCheckout(targetOrigin: string | undefined, msg: IframeMessage<'Checkout'>): void {
  postMessageToParentWindow(targetOrigin, msg);
}

// closeIframe closes this iframe via passing a request to close the
// iframe to the parent window.
export function closeIframe(targetOrigin: string | undefined): void {
  postMessageToParentWindow(targetOrigin, { kind: 'CloseIframe' });
}

// postMessageToParentWindow requires this window to be running in an
// iframe and posts a message to the parent window.
// postMessageToParentWindow helps clients ensure that any message
// passed to the parent window conforms to a shape expected by the
// parent window's message receiver. 
function postMessageToParentWindow(targetOrigin: string | undefined, msg: { kind: string; }): void {
  if (isRunningInAStandaloneWindow) throw new Error(`postMessageToParentWindow is only supported when running in an iframe, but this window is running in a standalone window. message=${JSON.stringify(msg)}`);
  else window.parent.postMessage(msg, targetOrigin || '*');
}
