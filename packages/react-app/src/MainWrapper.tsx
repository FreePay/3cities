import React, { useContext } from "react";
import { FaHandHoldingUsd, FaHome, FaQuestionCircle } from "react-icons/fa";
import { FaTelegram, FaTwitter } from "react-icons/fa6";
import { NavLink, NavLinkProps, Outlet } from "react-router-dom";
import { ConnectWalletButtonCustom } from "./ConnectWalletButton";
import { HideFooterOnMobileContext } from "./HideFooter";
import { Wordmark } from "./Wordmark";
import { useGoBackWithFallback } from "./useGoBackWithFallback";

const headerFooterFont = "text-black font-bold";

const OurNavLink: React.FC<NavLinkProps & {
  className?: string
}> = ({ children, className, ...props }) => {
  return <NavLink {...props} className={activeRouteClassName({
    ...(className !== undefined ? { className } : {}),
    activeClassName: "text-rose-900", // rose-900 is a very dark shade of our tertiary color
  })}>
    {children}
  </NavLink>

  // activeRouteClassName is as follows: NavLink's className prop can be
  // a function that takes { isActive, isPending } and returns a
  // dynamically constructed className (string | undefined).
  // activeRouteClassName is a convenience function to construct these
  // functions.
  function activeRouteClassName({ className: classNameInner, inactiveClassName, activeClassName, pendingClassName }: { className?: string, inactiveClassName?: string, activeClassName?: string, pendingClassName?: string }): Exclude<NavLinkProps['className'], string | undefined> {
    const fn = ({ isActive, isPending }: Parameters<Exclude<NavLinkProps['className'], string | undefined>>[0]) => {
      const s = `${classNameInner ? classNameInner : ''} ${!isActive && !isPending ? (inactiveClassName || '') : ''} ${isActive ? (activeClassName || '') : ''} ${isPending ? (pendingClassName || '') : ''}`.trim();
      if (s.length < 1) return undefined;
      else return s;
    };
    return fn;
  }
}

const Header: React.FC = () => {
  return (
    <header className={`hidden sm:flex bg-quaternary p-5 min-h-[80px] items-center w-full ${headerFooterFont}`}>
      <div className="flex flex-none items-center justify-start w-32 lg:w-48">
        <OurNavLink to="/">
          <Wordmark />
        </OurNavLink>
      </div>
      <div className="flex flex-1 gap-8 lg:gap-16 items-center justify-center px-4">
        {/* NB given the current layout of three links (Home, Request Money, and Me), the width of Home and Me must be the same for Request Money to be vertically centered in the viewport. If we add more links, we'll need to revisit this. */}
        <OurNavLink to="/" className="flex flex-col items-center text-center w-14 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10">
          <span className="text-sm">Home</span>
        </OurNavLink>
        <OurNavLink to="/pay-link" className="flex flex-col items-center text-center rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10">
          <span className="text-sm">Send Pay Link</span>
        </OurNavLink>
        <OurNavLink to="/about" className="flex flex-col items-center text-center w-14 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10">
          <span className="text-sm">About</span>
        </OurNavLink>
      </div>
      <div className="flex flex-none items-center justify-end">
        <div className="max-sm:min-w-[46vw] max-sm:max-w-32 lg:w-48">
          <ConnectWalletButtonCustom
            disconnectedLabel="Connect Wallet"
            className="rounded-md px-3.5 py-2 text-xs font-medium bg-white sm:enabled:hover:bg-gray-200 focus:outline-none enabled:active:scale-95 sm:enabled:hover:cursor-pointer w-full"
            disabledClassName="text-quaternary-darker pointer-events-none"
            enabledClassName="text-quaternary"
            loadingSpinnerClassName="text-quaternary-darker fill-white"
          />
        </div>
      </div>
    </header >
  );
}

const Footer: React.FC = () => {
  const hideFooterOnMobile = useContext(HideFooterOnMobileContext);
  return (
    <footer className={`fixed inset-x-0 bottom-0 sm:static bg-quaternary p-5 min-h-[80px] flex items-center ${headerFooterFont} ${hideFooterOnMobile ? 'max-sm:hidden' : ''}`}>
      <div className="mx-auto flex w-full sm:w-auto sm:gap-8 lg:gap-16 items-center justify-between">
        <OurNavLink to="/" className="sm:hidden flex flex-col items-center text-center w-10">
          <FaHome />
          <span className="text-sm">Home</span>
        </OurNavLink>
        <OurNavLink to="/pay-link" className="sm:hidden flex flex-col items-center text-center">
          <FaHandHoldingUsd />
          <span className="text-sm">Send Pay Link</span>
        </OurNavLink>
        <OurNavLink to="/about" className="sm:hidden flex flex-col items-center text-center w-10">
          <FaQuestionCircle />
          <span className="text-sm">About</span>
        </OurNavLink>
        {/* <OurNavLink to="/about" className="hidden sm:flex flex-none flex-col items-center text-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center">
          <span className="text-sm">About</span>
        </OurNavLink> */}
        <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="hidden sm:flex flex-none w-12 items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center text-lg">
          <FaTwitter />
        </a>
        <a href="https://t.me/+aMJE0gxJg9c2NWNh" target="_blank" rel="noreferrer" className="hidden sm:flex flex-none w-12 items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10 justify-center text-lg">
          <FaTelegram />
        </a>
      </div>
    </footer>
  );
}

// MainWrapper is a wrapper for ordinary routes that are part of the
// main app. It has a Header and Footer on desktop, and only a Footer on
// mobile with different contents than the desktop Footer.
export const MainWrapper = () => {
  const hideFooterOnMobile = useContext(HideFooterOnMobileContext);
  const includeBackButtonOnMobile = hideFooterOnMobile; // if the footer is hidden on mobile, we'll include a back button on mobile as otherwise there's no affordance to return to whence they came (because in this case mobile has neither a header or a footer)
  const goBack = useGoBackWithFallback('/'); // ie. go back if there's history to go back to, otherwise redirect home
  return (
    <div className="min-h-screen flex flex-col text-black">
      {/* <div className="fixed left-1/2 top-0 w-0.5 bg-red-500 h-full">this is a horizontally-centered vertical line for debug purposes</div> */}
      <Header />
      <div className={`absolute top-6 right-5 p-2 text-sm text-quaternary-darker sm:hidden ${includeBackButtonOnMobile ? '' : 'hidden'}`} onClick={goBack}>back</div>
      <div className="grow flex flex-col items-center justify-start bg-gray-100 pb-[120px] sm:pb-8">
        {/* NB the pb-[120px] on this parent div ensures there is sufficient (80px would be the minimum, and we added another 40px) blank space below the outlet that's the same height as the footer, which has the effect of ensuring that the user can scroll down to view the bottom of the content, otherwise the content bottom would be hidden behind the footer. */}
        <div className="w-full overflow-hidden px-5">
          <div className="sm:hidden flex justify-center items-center my-8"><Wordmark /></div>
          {/* NB that Outlet is nearly full width of the screen (except for the px-5 above) and its incumbent on child routes to center their content and set its max width if desired. This is in contrast to ConversionWrapper which forces nested routes into a small column in the middle of the page. MainWrapper's Outlet offers more freedom to accomodate a greater range of (ordinary/main) products. */}
          <Outlet />
        </div>
      </div>
      <Footer />
    </div>
  );
};
