"use client";

import { useBoost } from "@/hooks/useBoost";
import { getBoostDescription } from "@/services/boostService";

export default function BoostDisplay({ className }: { className?: string }) {
  const { data, isLoading, isError, calculateBoost, isCalculating } = useBoost();

  if (isLoading) {
    return (
      <div className={`w-full card rounded-md p-3 font-mono ${className}`}>
        <div className="animate-pulse">Loading boost...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`w-full card rounded-md p-3 font-mono ${className}`}>
        <div className="text-red-500">Error loading boost</div>
        <button
          onClick={calculateBoost}
          disabled={isCalculating}
          className="mt-2 text-sm text-blue-500 hover:text-blue-700 disabled:opacity-50"
        >
          {isCalculating ? "Calculating..." : "Retry"}
        </button>
      </div>
    );
  }

  const boostDescription = getBoostDescription(data.boostCoefficient);

  return (
    <div className={`w-full card rounded-md p-3 font-mono ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">
            {data.boostCoefficient}x {boostDescription}
          </div>
        </div>
        <button
          onClick={calculateBoost}
          disabled={isCalculating}
          className="text-sm text-blue-500 hover:text-blue-700 disabled:opacity-50"
        >
          {isCalculating ? "Updating..." : "Update"}
        </button>
      </div>
      
      {data.boostCoefficient > 1.0 && (
        <div className="mt-2 text-xs opacity-70">
          <div className="flex items-center gap-2">
            {data.hasBnbBoost && (
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900 rounded text-green-800 dark:text-green-200">
                BNB ✓
              </span>
            )}
            {data.hasAsterBoost && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-800 dark:text-blue-200">
                ASTER ✓
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
