import { hasOwnPropertyOfType } from "@3cities/core";
import React from "react";
import { Link, useRouteError } from "react-router-dom";
import useClipboard from "react-use-clipboard";
import { serialize, useAccount } from "wagmi";

const styleOuterDiv: React.CSSProperties = {
  position: 'absolute',
  top: '18.2%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
};

const styleInnerDiv: React.CSSProperties = {
  width: '61.8vw',
  maxWidth: '400px',
  position: 'relative',
  paddingTop: 'calc((472 / 1240) * 100%)',
  marginBottom: '10px',
};

const styleImg: React.CSSProperties = {
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
};

const styleSpan: React.CSSProperties = {
  fontSize: '26px',
};

export const GlobalErrorBoundary = () => {
  const error = useRouteError();
  const errorExplanation = hasOwnPropertyOfType(error, 'status', 'number') && hasOwnPropertyOfType(error, 'statusText', 'string') ? `${error.status} ${error.statusText}` : 'Internal Error';

  const { address } = useAccount();
  const errMsgToCopy = (() => {
    const errString = serialize({
      url: window.location.href,
      error,
      errorJson: `${error} ${serialize(error)}`,
    });
    if (address === undefined) return errString;
    else return errString.replace(new RegExp(address, 'gi'), '<redacted connected wallet address>');
  })();

  const [isErrorCopied, setCopied] = useClipboard(errMsgToCopy, {
    successDuration: 10000, // `isErrorCopied` will go back to `false` after 10000ms
  });

  return <div className="relative h-screen">
    <div style={styleOuterDiv}>
      <div style={styleInnerDiv}>
        <Link to="/"><img src="/wordmark-low-size.jpg" alt="Wordmark" style={styleImg} /></Link>
      </div>
      <span style={styleSpan}>{errorExplanation}</span>
    </div>
    <div className="absolute bottom-[30%] left-1/2 transform -translate-x-1/2 w-[61.8vw] max-w-[400px] grid grid-cols-1 gap-12">
      <button className="bg-primary sm:enabled:hover:bg-primary-darker text-white font-bold py-2 px-4 rounded w-full" disabled={isErrorCopied} onClick={setCopied}>{isErrorCopied ? 'Copied. DM to @3cities_xyz' : 'Copy Error'}</button>
      <span className="text-sm text-center">Please <span className="font-bold text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer" onClick={setCopied}>copy error</span> and paste in a DM to <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="font-bold text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer">@3cities_xyz</a></span>
      <span className="text-sm text-center">⚠️ Privacy warning: the copied error includes the current page link and any payment details</span>
    </div>
    <div className="absolute bottom-[5%] left-1/2 transform -translate-x-1/2">
      <span style={styleSpan}><Link to="/" className="text-blue-600 sm:hover:text-blue-800">Return Home</Link></span>
    </div>
  </div>;
}
