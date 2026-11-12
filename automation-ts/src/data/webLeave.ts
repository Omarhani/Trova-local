/**
 * A leave the admin adds for an employee on the portal (or by its API): the employee (job number to search, full name to
 * pick), the type and sub type by their Arabic names ("اجازة" / "سنوية"), the days yyyy-MM-dd, the note.
 */
export interface WebLeave {
  jobNumber: string;
  fullName: string;
  type: string;
  subType: string;
  from: string;
  to: string;
  notes: string;
}
