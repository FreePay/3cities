import QRCodeStyling, { Options } from 'qr-code-styling';
import React, { useEffect, useRef, useState } from 'react';
import useWindowSize from './useWindowSize';

// TODO add a download button using qr-code-styling's download API. This would let the user 1-click download the QR code.

// TODO add a share button using qr-code-styling's raw image API. This would let the user share the QR code as an image using the webshare api (eg. navigator.canShare).

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
    const opts: Options = {
      width,
      height,
      data,
      qrOptions: {
        errorCorrectionLevel: 'M', // here we use one level of error correction below the default of 'Q'. This results in substantially less encoded data and thus a high-resolutin QR code which makes it easier for older scanners to successfully scan it. The tradeoff is if the QR code is printed and damaged then there's less error correction to successfully scan the damaged QR code. https://www.qrcode.com/en/about/error_correction.html
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
      image: '/logo.png',
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
      const loadQRCodeStyling = async () => {
        const { default: QRCodeStylingLib } = await import('qr-code-styling'); // NB I verified that this lazy load of QRCodeStylingLib (which is the same value as the eagerly-imported QRCodeStyling does result in 13kb bundle savings. It seems like the eagerly-imported QRCodeStyling, which is used only as a type, is correctly tree-shaked out of the main bundle.)
        setQRCode(new QRCodeStylingLib(opts));
      };
      loadQRCodeStyling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height]);

  useEffect(() => {
    if (qrCode && qrCodeContainerRef.current) {
      qrCode.append(qrCodeContainerRef.current);
    }
  }, [qrCode]);

  return <div className="flex items-center justify-center" style={{ width, height }}>
    {qrCode ?
      <div ref={qrCodeContainerRef}></div>
      : <div className="bg-gray-200 rounded-md animate-pulse w-full h-full"></div>
    }
  </div>;
});

QRCode.displayName = 'QRCode';

export default QRCode;
