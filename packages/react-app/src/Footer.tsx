import React from "react";
import { FaCommentAlt, FaHome, FaTwitter } from "react-icons/fa";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="flex items-center bg-white p-5 text-sm font-medium w-full justify-center">
      <div className="flex items-center gap-2.5">
        <Link
          to="/"
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10"
        >
          <FaHome />
          Home
        </Link>
        {/* <Link
            to="/"
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10"
          >
            <FaQuestionCircle />
            FAQ
          </Link> */}
        <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10">
          <FaTwitter />
          Twitter
        </a>
        <a href="https://twitter.com/3cities_xyz" target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md px-2.5 py-1.5 transition sm:hover:bg-black sm:hover:bg-opacity-10">
          <FaCommentAlt />
          DM Feedback
        </a>
      </div>
    </footer>
  );
}
