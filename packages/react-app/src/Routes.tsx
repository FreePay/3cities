import React from "react";
import { createHashRouter, createRoutesFromElements, Route } from "react-router-dom";
import { About } from "./About";
import { BuildInfo } from "./BuildInfo";
import { CheckoutSettingsProvider } from "./CheckoutSettingsProvider";
import { ConversionWrapper } from "./ConversionWrapper";
import { FAQ } from "./FAQ";
import { GlobalErrorBoundary } from "./GlobalErrorBoundary";
import { GlobalProviders } from "./GlobalProviders";
import { HideFooterOnMobile } from "./HideFooter";
import { Home } from "./Home";
import { MainWrapper } from "./MainWrapper";
import { Me } from "./Me";
import { Pay } from "./Pay";
import { PayLinkNotFound } from "./PayLinkNotFound";
import { RequestMoney } from "./RequestMoney";

// TODO local error boundaries
export const router = createHashRouter(createRoutesFromElements(
  <Route path="/" element={<GlobalProviders />} errorElement={<GlobalErrorBoundary />}
  // loader={() => {
  //   console.log("router loader");
  //   return new Promise<null>((resolve) => {
  //     setTimeout(() => {
  //       console.log("router loader done");
  //       resolve(null);
  //     }, 5000);
  //   });
  // }}
  >
    <Route element={<HideFooterOnMobile />}>
      <Route element={<MainWrapper />}>
        {/* TODO there's an interesting render "bug" where because RequestMoney is nested as `HideFooterOnMobile > MainWrapper > RequestMoney` and Home is nested as `MainWrapper > Home`, the Connect Wallet button flickers when switching between these routes because it's being rerendered as the MainWrapper routes change. We should update so that ordinary route transitions minimize header/footer/etc rerenders. How to solve? --> see TODO in HideFooter.tsx as a starter solution (but would still create rerenders) --> it should be possible to send a message directly to Footer to hide the footer upon a route's request. Could also do a hack to hardcode the set of routes to hide the Footer inside the Footer itself */}
        <Route path="pay-link" element={<RequestMoney />} />
      </Route>
    </Route>
    <Route element={<MainWrapper />}>
      <Route index element={<Home />} />
      <Route path="about" element={<About />} />
      <Route path="faq" element={<FAQ />} />
      <Route path="me" element={<Me />} />
      {/* <Route path="donations" element={<ReceiveDonationsLandingPage />} />
      <Route path="point-of-sale" element={<PointOfSaleLandingPage />} />
      <Route path="payment-method" element={<PaymentMethodLandingPage />} /> */}
      <Route path="buildinfo" element={<BuildInfo />} />
    </Route>
    {/* NB some routes don't need ConversionWrapper but do need CheckoutSettingsProvider (such as a merchant employee point-of-sale dashboard); and some routes need both ConversionWrapper and CheckoutSettingsProvider. And some future routes may need only ConversionWrapper but not CheckoutSettingsProvider. */}
    <Route element={<CheckoutSettingsProvider elementForPathIfCheckoutSettingsNotFound={{
      /* NB when using both CheckoutSettingsProvider and ConversionWrapper, ConversionWrapper must be nested inside CheckoutSettingsProvider so that if the CheckoutSettings deserialization fails, the fallback element is not rendered inside the ConversionWrapper (as these fallbacks are typically standalone error pages) */
      'pay': <PayLinkNotFound />,
    }} />}>
      <Route element={<ConversionWrapper />}>
        <Route path="pay" element={<Pay />} /> {/* WARNING the route https://3cities.xyz/#/pay?c=<v1 payload> is part of our public API and commitment to customers to maintain backwards compatibility forever */}
        {/* <Route path="donate" element={<Donate />} /> */}
        {/* <Route path="prepare-checkout" element={<PointOfSaleCheckoutConfig />} />  */}
        {/* <Route path="checkout" element={<Checkout />} /> */}
      </Route>
    </Route>
  </Route>
));
