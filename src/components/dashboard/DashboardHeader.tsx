
import React from 'react';
import ProfileMenu from '@/components/ProfileMenu';

const DashboardHeader = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-eco-green-700">CivicSort Labs</h1>
          </div>
          
          <div className="flex items-center">
            <ProfileMenu />
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
