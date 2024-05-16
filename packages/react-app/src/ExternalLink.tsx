import React from "react";
import { FaExternalLinkAlt } from "react-icons/fa";

type ExternalLinkProps = {
  href: string;
  className?: string;
  children?: React.ReactNode;
}

// ExternalLink is our component for a link that goes to a different
// website.
export const ExternalLink: React.FC<ExternalLinkProps> = ({ href, className, children }) => {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`text-primary sm:hover:cursor-pointer sm:hover:text-primary-darker inline-flex items-center gap-1 ${className || ''}`}>{children} <FaExternalLinkAlt /></a>;
};
