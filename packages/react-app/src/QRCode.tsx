import QRCodeStyling, { Options } from 'qr-code-styling';
import React, { useEffect, useRef, useState } from 'react';
import { Spinner } from './Spinner';
import useWindowSize from './useWindowSize';

// TODO add a download button using qr-code-styling's download API. This would let the user 1-click download the QR code.

// TODO add a share button using qr-code-styling's raw image API. This would let the user share the QR code as an image using the webshare api (eg. navigator.canShare).

let qrCodeStylingLibPromise: Promise<typeof QRCodeStyling> | undefined = undefined;
async function getQRCodeStylingLib(): Promise<typeof QRCodeStyling> {
  if (qrCodeStylingLibPromise === undefined) {
    qrCodeStylingLibPromise = import('qr-code-styling').then(lib => lib.default); // this lazy load of qr-code-styling results in ~14kB bundle savings. NB the eagerly-imported QRCodeStyling is used only as a type, and so is correctly tree-shaked out of the main bundle --> to double-check this, we can add "import QRCodeStylingLib from 'qr-code-styling';" at the top and comment out the lazy load --> main bundle size increases by 14.3kB
  }
  return qrCodeStylingLibPromise;
} // @eslint-no-use-below[qrCodeStylingLibPromise]
getQRCodeStylingLib(); // immediately begin lazily loading the qr-code-styling dependency so that, during QR code generation below, it's already available and the user doesn't have to wait for the lazy load

const qrCodeImageUrl = '/logo.png'; // TODO why does this QR code image not always show up on webkit/safari/iPhone?
async function loadQrCodeImage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = qrCodeImageUrl;
    img.onload = () => resolve();
    img.onerror = (error) => {
      console.log("failed to load qr code image", error);
      reject(error);
    };
  });
}
loadQrCodeImage(); // immediately begin lazily loading the logo image so that, during QR code generation below, it's already available and the user doesn't have to wait for the lazy load

interface QRCodeProps {
  data: string;
}

export const QRCode: React.FC<QRCodeProps> = React.memo(({ data }: QRCodeProps) => {
  const qrCodeContainerRef = useRef<HTMLDivElement | null>(null);
  const [qrCode, setQRCode] = useState<QRCodeStyling | null>(null);

  const windowSize = useWindowSize();
  const width = Math.min(Math.round(windowSize.width * 0.9), 260); // here we make the width no larger than 80% of the screen width. This ensures that a QR code with some horizontal padding (eg. inside a Modal) will still be fully visible on narrower devices.
  const height = width;

  useEffect(() => {
    let isMounted = true;
    const opts: Options = {
      width,
      height,
      data,
      qrOptions: {
        errorCorrectionLevel: 'M', // here we use one level of error correction below the default of 'Q'. This results in substantially less encoded data and thus a high-resolution QR code which makes it easier for older scanners to successfully scan it. The tradeoff is if the QR code is printed and damaged then there's less error correction to successfully scan the damaged QR code. https://www.qrcode.com/en/about/error_correction.html --> NB also, for an unknown reason, using a level of 'Q' or 'H' results in the render size of the QR code being smaller (taking up only a middle portion of its canvas), which looks worse, so we'll stick with 'M' for now.
      },
      dotsOptions: {
        gradient: {
          type: "linear",
          colorStops: [
            // treatment #1:
            // { offset: 0, color: "#3b82f6" },
            // { offset: 1, color: "#f6bf3a" },

            // treatment #2:
            // { offset: 0, color: "#3b82f6" },
            // { offset: 0.5, color: "#f63a76" },
            // { offset: 1, color: "#f6bf3a" },

            // treatment #3:
            // { offset: 0, color: "#3b82f6" },
            // { offset: 0.33, color: "#b43af6" },
            // { offset: 0.66, color: "#f63a76" },
            // { offset: 1, color: "#f6bf3a" },

            // treatment #4:
            { offset: 0, color: "#111827" },
            { offset: 1, color: "#374151" },
          ],
          rotation: 0.75,
        },
        type: 'classy-rounded',
      },
      backgroundOptions: {
        color: "transparent",
      },
      image: qrCodeImageUrl,
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.30,
        margin: 8,
        crossOrigin: "anonymous",
      },
      // cornersSquareOptions: {
      //   color: "#3b82f6",
      // },
      // cornersDotOptions: {
      //   color: "#f6bf3a",
      // },
    };
    if (qrCode) qrCode.update(opts);
    else {
      (async () => {
        const QRCodeStylingLib = await getQRCodeStylingLib();
        // await sleep(5000); // this sleep code can be used to test UX for QR codes that load slowly for any reason
        if (isMounted) setQRCode(new QRCodeStylingLib(opts));
        // function sleep(ms: number) {
        //   return new Promise(resolve => setTimeout(resolve, ms));
        // }
      })();
    }
    return () => {
      isMounted = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setQRCode, data, width, height]);

  useEffect(() => {
    if (qrCode && qrCodeContainerRef.current) {
      qrCode.append(qrCodeContainerRef.current);
    }
  }, [qrCode]);

  return <div className="flex items-center justify-center" style={{ width, height }}>
    {qrCode ?
      <div ref={qrCodeContainerRef}></div>
      : <div className="flex items-center justify-center bg-gray-200 rounded-md w-full h-full">
        <Spinner containerClassName="h-1/4 w-1/4" spinnerClassName="text-gray-400" speed="slow" />
      </div>
    }
  </div>;
});

QRCode.displayName = 'QRCode';

export default QRCode;
