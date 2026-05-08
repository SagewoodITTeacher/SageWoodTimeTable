import React from "react";

interface TeacherStatusBadgesProps {
  isBlockedByBreak?: boolean;
  isBlockedByAfternoon?: boolean;
  isUsed?: boolean;
}

export function TeacherStatusBadges({
  isBlockedByBreak,
  isBlockedByAfternoon,
  isUsed,
}: TeacherStatusBadgesProps) {
  return (
    <>
      {isBlockedByBreak && (
        <span className="text-[7px] font-black bg-amber-600 text-white px-1 rounded uppercase whitespace-nowrap">
          Break Duty
        </span>
      )}
      {isBlockedByAfternoon && (
        <span className="text-[7px] font-black bg-blue-600 text-white px-1 rounded uppercase whitespace-nowrap">
          Afternoon Duty
        </span>
      )}
      {isUsed && !isBlockedByBreak && !isBlockedByAfternoon && (
        <span className="text-[7px] font-black bg-gray-500 text-white px-1 rounded uppercase whitespace-nowrap">
          Occupied
        </span>
      )}
    </>
  );
}
