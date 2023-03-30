import React from "react";

type Props = {
  heading: React.ReactNode
  children?: React.ReactNode
};

export const ContentWrapper: React.FC<Props> = ({ heading, children }) => {
  return (
    <>
      <span className="flex justify-center pb-5 text-3xl font-bold tracking-tight text-white">
        {heading}
      </span>
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white p-5 shadow-lg">
        {children}
      </div>
    </>
  );
};
