const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  return (
    <div className="flex flex-col justify-center items-center h-64 space-y-4">
      <div className="relative">
        <div 
          className={`${sizeClasses[size] || sizeClasses['md']} animate-spin rounded-full border-4 border-gray-200`}
        ></div>
        <div 
          className={`absolute top-0 left-0 ${sizeClasses[size] || sizeClasses['md']} animate-spin rounded-full border-t-4 border-b-4 border-blue-500`}
        ></div>
      </div>
      {message && (
        <p className="text-gray-600 text-center max-w-xs">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
