
export const serializedCheckoutSettingsUrlParam = "c"; // url param where CheckoutSettingsProvider expects to find the serialized CheckoutSettings. Clients constructing urls with serialized CheckoutSettings should use this export to ensure they are picking the url param correctly. In the future, we could fully hide this url param inside this library with an API like eg. addSerializedCheckoutSettingsToUrl(url: URL, cs: CheckoutSettings): URL

// makeCheckoutUrl is our canonical way to create a 3cities checkout URL
// (pay request URL) for the passed serialized CheckoutSettings. The
// definition of CheckoutSettings serialization correctness is owned by
// CheckoutSettingsProvider.
export function makeCheckoutUrl(serializedCheckoutSettings: string): string {
  // WARNING we might be tempted to remove the "http://" and "https://" from checkoutLink to make it a bit shorter when pasted. However, the URL protocol is required for the link to be considered valid by the WebShare API, and <a> tags will consider an URL to be a relative link if it contains no protocol, and 3rd party link parsers (to make a pasted link clickable) often require the protocol to properly detect the link, eg. discord won't make "3cities.xyz" clickable without an URL protocol
  return `${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP'] ? `http://${process.env['REACT_APP_DEVELOPMENT_INTRANET_IP']}${location.port.length > 0 ? `:${location.port}` : ''}` : location.origin}/#/pay?${serializedCheckoutSettingsUrlParam}=${serializedCheckoutSettings}`; // REACT_APP_DEVELOPMENT_INTRANET_IP is a development feature. Set it in .env.local so that payment links generated on your laptop can be opened on your phone using the LAN
}
