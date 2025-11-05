import React from 'react';

const StatusIndicator = ({ status, message, className = '' }) => {
  const statusConfig = {
    loading: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-700',
      icon: (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      )
    },
    success: {
      bg: 'bg-green-50 border-green-200',
      text: 'text-green-700',
      icon: (
        <div className="flex items-center justify-center w-4 h-4 bg-green-500 rounded-full">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      icon: (
        <div className="flex items-center justify-center w-4 h-4 bg-red-500 rounded-full">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      )
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-700',
      icon: (
        <div className="flex items-center justify-center w-4 h-4 bg-yellow-500 rounded-full">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
  };

  const config = statusConfig[status] || statusConfig.loading;

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-3 rounded-lg border ${config.bg} ${className}`}>
      {config.icon}
      <span className={`font-medium ${config.text}`}>{message}</span>
    </div>
  );
};

export default StatusIndicator;