import React from 'react';
import { useModal } from '../Context/Modal';
import { IoIosAlert } from 'react-icons/io';

interface AlertMessage {
  message?: string;
  image?: string;
}

const UnAuthorizedModal: React.FC<{ alertMessage: AlertMessage[] | null }> = ({
  alertMessage,
}) => {
  const { hideModal } = useModal();

  return (
    <div className="p-4 md:p-2">
      {alertMessage?.map((alert, index) => (
        <div
          key={index}
          className="flex items-center my-2 py-2 border-b-2 border-gray-200"
        >
          {/* User Image */}
          <IoIosAlert className="w-24 h-24 text-red-500 rounded-full " />

          <h2 className="ml-4 text-2xl font-semibold text-gray-900 dark:text-white">
            {alert.message}
          </h2>
        </div>
      ))}
      <button
        onClick={() => hideModal(true)}
        type="submit"
        className="w-full bg-emerald-600 text-white p-2.5 rounded-xl font-bold hover:bg-emerald-700 transition shadow-sm cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
};

export default UnAuthorizedModal;
