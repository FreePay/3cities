import React from "react";

type SpinnerProps = {
  containerClassName?: string; // className to apply to the spinner's container. Useful to eg. position the spinner
  spinnerClassName?: string; // className to apply to the spinner itself. The spinner color is the text color in this className (or inherited)
}

export function Spinner({ containerClassName, spinnerClassName }: SpinnerProps) {
  // great collection of svg spinners: https://github.com/n3r4zzurr0/svg-spinners
  return <span className={containerClassName}>
    <svg role="status" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={`${spinnerClassName || ''} animate-spin-fast`}>
      <path d="M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.54,1.54,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z" fill="currentColor" />
      {/* <path d="M2,12A11.2,11.2,0,0,1,13,1.05C12.67,1,12.34,1,12,1a11,11,0,0,0,0,22c.34,0,.67,0,1-.05C6,23,2,17.74,2,12Z" fill="currentColor" /> // this is an alternative style https://raw.githubusercontent.com/n3r4zzurr0/svg-spinners/main/svg-css/eclipse.svg */}
    </svg>
  </span>;
}

// Client example of a containerClassName for an inline-block spinner: "inline-block ml-[+0.500em] h-6 w-6"

// Client example of a containerClassName for an absolutely positioned spinner that's vertically centered and near the right side of its container: "absolute top-1/2 transform -translate-y-1/2 right-4 z-10 h-6 w-6 flex items-center justify-center" // requires parent to be positioned relatively

// svg+tailwind implementation example of automatically setting a path's fill color by darkening the current text color: <path className="fill-current brightness-[0.80]" ...></path>
