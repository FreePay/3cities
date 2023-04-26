import React from "react";
import { FaQrcode } from "react-icons/fa";
import { Link } from "react-router-dom";
import { About } from "./About";
import payDemoImage from "./images/pay-demo.png";
import Modal from "./Modal";
import QRCode from "./QRCode";

export const Home: React.FC = () => {
  const [showQrCodeModalNonce, setShowQrCodeModalNonce] = React.useState(0);
  const payDemoElement = <div>
    <div className="relative py-12 flex justify-center">
      <span className="absolute top-3 left-1/2 transform -translate-x-1/2">What they see:</span>
      <div className="border border-gray-300 rounded-md shadow-xl">
        <img src={payDemoImage} className="max-w-[360px] rounded-md" alt="3cities payment link demo" />
      </div>
      <Link to="/pay?c=H4sIAOOoRGQAAwUAOw6CMPQqzk7lI5-xYIyTMUFnUuFRidA2ryXBzTi4eAE3E2WRTd0c9RTewiOY_V2hVFJDTjkC1CDM4WYkzXMErb9D0o48xw5pnPu2xxzfsXy_CKLCLkI3Zh6xYhJFTuxO6CVV7y5FpT6dkAb6qhHZevA7n46PSvIyYxXVGsyizDaA12UyfrFaNsJQHZV81tQrwCm0icFS8J60xLJsFgTkqQ0yA3w7RygAQWSgd3-IcFTTtgAAAA.." className="text-primary sm:hover:text-primary-darker font-bold absolute bottom-3 left-1/2 transform -translate-x-1/2">
        Live Demo
      </Link>
    </div>
  </div >;
  return <div>
    <div className="sm:my-8">
      <div className="text-left max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h2 className="text-2xl mb-4"><Link to="/request-money" className="text-primary sm:hover:text-primary-darker font-bold">
            Request Money
          </Link> using 3cities</h2>
          <p className="mb-4">
            Send a money request link to anyone in the world. It&apos;s fast and free.
          </p>
          <p className="sm:mb-8">
            <Link to="/request-money" className="text-primary sm:hover:text-primary-darker font-bold">
              Try it now
            </Link>
            <span className="ml-1">(no sign-up needed)</span>
          </p>
          <div className="sm:hidden my-4">
            {payDemoElement}
          </div>
          <h2 className="text-2xl mb-4">How It Works</h2>
          <ol className="list-decimal list-inside mb-8">
            <li className="mb-2">
              Set the US Dollar amount to request
            </li>
            {/* <li className="mb-2">
              Our default tokens and chains work for most users, but can be customized easily
            </li> */}
            <li>
              Share the payment link and they can pay with any crypto wallet
            </li>
          </ol>
          <p>
            <Link to="/request-money" className="text-primary sm:hover:text-primary-darker text-2xl font-bold">
              Send a Payment Link
            </Link>
          </p>
        </div>
        <div className="hidden sm:block">
          {payDemoElement}
        </div>
      </div>
    </div>
    <div className="sm:hidden mt-8 border-t-2">
      <About />
      <div className="mt-8 w-full flex items-center justify-center" onClick={() => setShowQrCodeModalNonce(n => n + 1)}>
        <FaQrcode />
      </div>
      <Modal showModalNonce={showQrCodeModalNonce}>
        <div className="w-full h-fit flex flex-col items-center justify-center gap-4">
          <QRCode data={location.href} />
        </div>
      </Modal>
    </div>
  </div>;
};
