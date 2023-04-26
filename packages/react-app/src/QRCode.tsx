import QRCodeStyling, { Options } from 'qr-code-styling';
import React, { useEffect, useRef, useState } from 'react';

// TODO add a download button using qr-code-styling's download API. This would let the user 1-click download the QR code.

// TODO add a share button using qr-code-styling's raw image API. This would let the user share the QR code as an image using the webshare api (eg. navigator.canShare).

interface QRCodeProps {
  data: string;
}

const width = 256;
const height = 256;

export const QRCode: React.FC<QRCodeProps> = React.memo(({ data }: QRCodeProps) => {
  const qrCodeContainerRef = useRef<HTMLDivElement | null>(null);
  const [qrCode, setQRCode] = useState<QRCodeStyling | null>(null);

  useEffect(() => {
    const opts: Options = {
      width,
      height,
      data,
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
        imageSize: 0.35,
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
  }, [data]);

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
