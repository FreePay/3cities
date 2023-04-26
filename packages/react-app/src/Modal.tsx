import React, { useEffect, useRef } from 'react';

interface ModalProps {
  showModalNonce: number; // showModalNonce lets the client hide or show the modal programmatically. If showModalNonce < 1, the modal will be hidden, otherwise the modal will be shown. A client can re-show the modal (which might have been dismissed by the user) by incrementing showModalNonce, or hide the modal by resetting showModalNonce to 0. Of course, the user can hide the modal by dismissing it.
  children?: React.ReactNode;
}

// Modal is our basic multi-purpose modal to pop-up a dismissable dialog
// box that contains its children as content. Our Modal's API tends to
// be a lot simpler than 3rd-party modals; it's sort of a
// quick-and-dirty modal.
const Modal: React.FC<ModalProps> = ({ showModalNonce, children }) => {
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const modalContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showModalNonce > 0) setIsModalVisible(true);
    else setIsModalVisible(false);
  }, [showModalNonce]);

  const handleClickOutside = (event: MouseEvent) => {
    if (modalContentRef.current && !modalContentRef.current.contains(event.target as Node)) {
      setIsModalVisible(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return !isModalVisible ? null : <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
    <div ref={modalContentRef} className="relative bg-gray-100 p-8 rounded-lg shadow-md w-full max-w-[92vw] sm:max-w-md">
      <button className="text-gray-700 absolute top-2 right-2 z-10" onClick={() => setIsModalVisible(false)} >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
          <path fillRule="evenodd" clipRule="evenodd" d="M10 9.293l5.146-5.147a.5.5 0 01.708.708L10.707 10l5.147 5.146a.5.5 0 01-.708.708L10 10.707l-5.146 5.147a.5.5 0 01-.708-.708L9.293 10 4.146 4.854a.5.5 0 11.708-.708L10 9.293z" />
        </svg>
      </button>
      {children}
    </div>
  </div>;
};

export default Modal;
