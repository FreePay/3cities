import React from "react";
import { createHashRouter, createRoutesFromElements, Route } from "react-router-dom";
import { About } from "./About";
import { BuildInfo } from "./BuildInfo";
import { ContextLink } from "./ContextLink";
import { ConversionWrapper } from "./ConversionWrapper";
import { FAQ } from "./FAQ";
import { GlobalErrorBoundary } from "./GlobalErrorBoundary";
import { GlobalProviders } from "./GlobalProviders";
import { Home } from "./Home";
import "./index.css";
import { MainWrapper } from "./MainWrapper";
import { Me } from "./Me";
import { Pay } from "./Pay";
import { RequestMoney as RequestMoneyLandingPage } from "./RequestMoney";

// TODO local error boundaries
export const router = createHashRouter(createRoutesFromElements(
  <Route path="/" element={<GlobalProviders />} errorElement={<GlobalErrorBoundary />}
  // loader={() => {
  //   console.log("router loader");
  //   return new Promise((resolve) => {
  //     setTimeout(() => {
  //       console.log("router loader done");
  //       resolve(undefined);
  //     }, 5000);
  //   });
  // }}
  >
    <Route element={<MainWrapper />}>
      <Route index element={<Home />} />
      <Route path="about" element={<About />} />
      <Route path="faq" element={<FAQ />} />
      <Route path="me" element={<Me />} />
      <Route path="request-money" element={<RequestMoneyLandingPage />} />
      {/* <Route path="donations" element={<ReceiveDonationsLandingPage />} />
      <Route path="point-of-sale" element={<PointOfSaleLandingPage />} />
      <Route path="payment-method" element={<PaymentMethodLandingPage />} /> */}
      <Route path="buildinfo" element={<BuildInfo/>} />
    </Route>
    {/* <Route path="0/:serialized" loader={deserializeContextLink} errorElement={<InvalidContextLink /> /> // no `element`; loader either throws redirect or throws error https://reactrouter.com/en/main/start/overview#redirects */}
    <Route
      // loader={deserializeContextLink}
      element={<ContextLink />}>
      <Route element={<ConversionWrapper />}>
        <Route path="pay" element={<Pay />} />
        {/* <Route path="donate" element={<Donate />} />
        <Route path="prepare-checkout" element={<PointOfSaleCheckoutConfig />} />
        <Route path="checkout" element={<Checkout />} /> */}
      </Route>
    </Route>
  </Route >
));
