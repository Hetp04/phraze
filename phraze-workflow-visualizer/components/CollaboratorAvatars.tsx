import React from 'react';

export const CollaboratorAvatars = () => {
  return (
    <div className="flex -space-x-2 overflow-hidden items-center justify-center p-1 bg-white rounded-full shadow-sm border border-gray-100">
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user1/100/100"
        alt="User 1"
      />
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user2/100/100"
        alt="User 2"
      />
      <img
        className="inline-block h-6 w-6 rounded-full ring-2 ring-white"
        src="https://picsum.photos/seed/user3/100/100"
        alt="User 3"
      />
      <div className="h-6 w-6 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-medium">
        +2
      </div>
    </div>
  );
};