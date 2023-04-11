import React from "react";
import { createHashRouter, createRoutesFromElements, Link, Outlet, Route, RouterProvider } from "react-router-dom";
import { buildGitCommit, buildGitCommitDate, buildGitTag } from "./buildInfo";
import { ConversionWrapper } from "./ConversionWrapper";
import { GlobalErrorBoundary } from "./GlobalErrorBoundary";
import { GlobalProviders } from "./GlobalProviders";
import "./index.css";
import { MainWrapper } from "./MainWrapper";
import { Pay } from "./Pay";
import { RequestMoney as RequestMoneyLandingPage } from "./RequestMoney";

const ContextLink = () => {
  return <div>
    <Outlet />
  </div>;
};

const Home = () => {
  return <div>
    <Link to="/request-money" className="inline-block px-4 py-2 leading-none text-white bg-blue-600 rounded-md hover:bg-blue-800 focus:outline-none focus:shadow-outline">Request Money</Link>
  </div>;
};

// TODO local error boundaries
const router = createHashRouter(createRoutesFromElements(
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
      {/* <Route path="me" element={<MyProfile />} /> */}
      <Route path="request-money" element={<RequestMoneyLandingPage />} />
      {/* <Route path="donations" element={<ReceiveDonationsLandingPage />} />
      <Route path="point-of-sale" element={<PointOfSaleLandingPage />} />
      <Route path="payment-method" element={<PaymentMethodLandingPage />} /> */}
      <Route path="buildinfo" element={<span>3cities {buildGitTag} {buildGitCommit} {buildGitCommitDate}<br />Time now: {(new Date()).toUTCString()}</span>} />
    </Route>
    <Route element={<ConversionWrapper />}>
      {/* <Route path="0/:serialized" loader={deserializeContextLink} errorElement={<InvalidContextLink /> /> // no `element`; loader either throws redirect or throws error https://reactrouter.com/en/main/start/overview#redirects */}
      <Route
        // loader={deserializeContextLink}
        element={<ContextLink />}>
        <Route path="pay" element={<Pay />} />
        {/* <Route path="donate" element={<Donate />} />
        <Route path="prepare-checkout" element={<PointOfSaleCheckoutConfig />} />
        <Route path="checkout" element={<Checkout />} /> */}
      </Route>
    </Route>
  </Route >
));

const loadingPlaceholderInnerHtml: string = (() => {
  const p = process.env['REACT_APP_LOADING_PLACEHOLDER_INNER_HTML'];
  if (p === undefined || p.length < 1) throw new Error(`expected REACT_APP_LOADING_PLACEHOLDER_INNER_HTML to be defined`);
  else return p;
})();

const LoadingPlaceholder = () => <div dangerouslySetInnerHTML={{ __html: loadingPlaceholderInnerHtml }} />;

export const App = () => <RouterProvider router={router} fallbackElement={<LoadingPlaceholder />} />;
