import React from "react";
import { Link } from "react-router-dom";

// TODO this page is a modified fork of GlobalErrorBoundary. Eventually, we should standardize error page layout instead of forking the code in multiple files

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

export const PayLinkNotFound = () => {
  return <div className="relative h-screen">
    <div style={styleOuterDiv}>
      <div style={styleInnerDiv}>
        <Link to="/"><img src="/wordmark-low-size.jpg" alt="Wordmark" style={styleImg} /></Link>
      </div>

    </div>
    <div className="absolute bottom-[40%] left-1/2 transform -translate-x-1/2 w-[61.8vw] max-w-[400px] grid grid-cols-1 gap-12">
      <span className="text-[26px] text-center">Pay Link not found</span>
      <span className="text-center">Please request a new link</span>
      <span className="text-center">You can also DM the link to <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="font-bold text-primary sm:hover:text-primary-darker sm:hover:cursor-pointer">@3cities_xyz</a> for help</span>
    </div>
    <div className="absolute bottom-[5%] left-1/2 transform -translate-x-1/2">
      <span style={styleSpan}><Link to="/" className="text-blue-600 sm:hover:text-blue-800">Return Home</Link></span>
    </div>
  </div>;
}
