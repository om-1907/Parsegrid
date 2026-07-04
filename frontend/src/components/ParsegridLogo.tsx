import React from 'react';

export const ParsegridLogo = ({
  className = "h-8 w-8",
  textClassName = "text-foreground",
}: {
  className?: string;
  textClassName?: string;
}) => {
  return (
    <div className="flex items-center gap-3">
      <svg
        className={className}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shield structure */}
        <path d="M50 15L80 25V55C80 72 67 85 50 90C33 85 20 72 20 55V25L50 15Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>
        {/* Parse/validation chevron */}
        <path d="M45 35L62 50L45 65" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="62" cy="50" r="5" fill="currentColor" />
      </svg>
      <span className={`text-xl font-bold tracking-tight ${textClassName}`}>
        Parsegrid
      </span>
    </div>
  );
};
