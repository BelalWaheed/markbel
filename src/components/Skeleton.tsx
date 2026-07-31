import React from 'react';

export function CardSkeleton() {
  return (
    <div className="studio-card flex flex-col h-[320px] animate-pulse bg-white">
      {/* Image placeholder */}
      <div className="h-40 bg-gray-200 w-full" />
      
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Title placeholder */}
        <div className="h-5 bg-gray-200 rounded-md w-3/4" />
        <div className="h-5 bg-gray-200 rounded-md w-1/2" />
        
        {/* Description placeholder */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="h-3 bg-gray-200 rounded-md w-full" />
          <div className="h-3 bg-gray-200 rounded-md w-5/6" />
        </div>
        
        {/* Footer placeholder */}
        <div className="flex justify-between items-center mt-2 pt-3 border-t border-[var(--color-border-default)]">
          <div className="h-4 bg-gray-200 rounded-md w-1/4" />
          <div className="flex gap-2">
            <div className="h-6 w-6 bg-gray-200 rounded-full" />
            <div className="h-6 w-6 bg-gray-200 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FolderSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-[var(--color-border-default)] bg-white/50 animate-pulse flex items-center gap-3">
      <div className="w-5 h-5 bg-gray-200 rounded" />
      <div className="h-4 bg-gray-200 rounded-md w-1/2" />
    </div>
  );
}
