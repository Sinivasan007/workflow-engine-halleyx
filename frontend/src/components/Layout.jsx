import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children, title }) {
  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Fixed Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 z-20">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1" style={{ marginLeft: '256px' }}>

        {/* Fixed Navbar */}
        <header 
          className="fixed top-0 right-0 bg-white shadow-sm h-16 z-10 flex items-center px-8 border-b border-gray-200"
          style={{ left: '256px' }}
        >
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto pt-20 px-6 pb-6">
          {children}
        </main>

      </div>
    </div>
  );
}
