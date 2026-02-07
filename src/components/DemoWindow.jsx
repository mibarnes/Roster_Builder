import React, { useState } from 'react';

/**
 * DemoWindow - A wrapper component that provides a windowed demo interface
 * with an exit button in the bottom left corner and full feature access
 */
export default function DemoWindow({ children, onExit }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleExit = () => {
    setIsExiting(true);
    // Trigger exit animation, then call onExit callback
    setTimeout(() => {
      if (onExit) {
        onExit();
      } else {
        // Default behavior: show exit message
        alert('Demo window closed. Thank you for using Miami Hurricanes Roster Portal!');
        window.location.reload();
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-95 p-4">
      {/* Demo Window Container */}
      <div
        className={`relative w-full h-full max-w-[1920px] max-h-[1080px] bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl border-2 border-miami-green overflow-hidden transition-all duration-300 ${
          isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
      >
        {/* Window Header Bar */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-r from-miami-green to-green-600 flex items-center px-4 z-10">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex-1 text-center text-white text-sm font-semibold">
            Miami Hurricanes - CFB Roster Portal (Demo Mode)
          </div>
        </div>

        {/* Main Content Area */}
        <div className="absolute inset-0 top-8 bottom-16 overflow-auto">
          {children}
        </div>

        {/* Exit Button - Bottom Left */}
        <div className="absolute bottom-4 left-4 z-20">
          <button
            onClick={handleExit}
            className="group flex items-center justify-center w-12 h-12 bg-red-600 hover:bg-red-700 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
            title="Exit Demo"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          <div className="absolute left-14 bottom-0 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Exit Demo
          </div>
        </div>

        {/* Footer Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gray-800 border-t border-gray-700 flex items-center justify-between px-6">
          <div className="text-gray-400 text-sm">
            All features enabled | Mock data mode
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-gray-400 text-sm">Live</span>
            </div>
            <div className="text-gray-500 text-xs">
              © 2026 Miami Hurricanes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
