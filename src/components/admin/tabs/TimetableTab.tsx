import React from "react";
import { ExamTimetableTab } from "./ExamTimetableTab";
import { Teacher, TimetableEntry, Venue, Subject } from "../../../types";

interface TimetableTabProps {
  timetableDate: string;
  setTimetableDate: (d: string) => void;
  entries: TimetableEntry[];
  teachers: Teacher[];
  venues: Venue[];
  isSaving: boolean;
  subjects: Subject[];
  lockedDates: string[];
  onBackup?: () => void;
}

export function TimetableTab({
  timetableDate,
  setTimetableDate,
  entries,
  teachers,
  venues,
  isSaving,
  subjects,
  lockedDates,
  onBackup,
}: TimetableTabProps) {
  return (
    <ExamTimetableTab
      date={timetableDate}
      setDate={setTimetableDate}
      entries={entries}
      teachers={teachers}
      venues={venues}
      isSaving={isSaving}
      allSubjectsList={subjects}
      lockedDates={lockedDates}
      onBackup={onBackup}
    />
  );
}
