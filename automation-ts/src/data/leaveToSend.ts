import { LeaveKind } from './leaveTypes';

/** a leave request the employee sends: the type (its card and list ids from the app's own list), the day, today and the run's note */
export interface LeaveToSend {
  kind: LeaveKind;
  day: Date;
  today: Date;
  note: string;
}
