import React from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import "./index.css";

const styleOuterDiv: React.CSSProperties = {
  position: 'absolute',
  top: '38.2%',
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
  const content = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'Internal Error';
  return <div className="relative h-screen">
    <div style={styleOuterDiv}>
      <div style={styleInnerDiv}>
        <Link to="/"><img src="/wordmark-low-size.jpg" alt="Wordmark" style={styleImg} /></Link>
      </div>
      <span style={styleSpan}>{content}</span>
    </div>
    <div className="absolute bottom-[20%] left-1/2 transform -translate-x-1/2">
      <span style={styleSpan}><Link to="/" className="text-blue-600 hover:text-blue-800">Return Home</Link></span>
    </div>
  </div>;
}
