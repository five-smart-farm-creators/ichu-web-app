import type {
  ActivityApplication, ActivityFollowUp, PlannedActivity, RecordApplication, ScheduleActivity, ScheduleFollowUp,
} from '../model/planned-activity.model';
import type { PlanningPeriod } from '../model/planning-calendar';

/** Reads and changes the planned activities of one ranch, with their applications and follow-ups. */
export abstract class PlannedActivityRepository {
  abstract calendar(ranchId: string, period: PlanningPeriod): Promise<readonly PlannedActivity[]>;
  abstract get(ranchId: string, activityId: string): Promise<PlannedActivity>;
  abstract schedule(ranchId: string, request: ScheduleActivity): Promise<PlannedActivity>;
  abstract listApplications(ranchId: string, activityId: string): Promise<readonly ActivityApplication[]>;
  abstract recordApplication(ranchId: string, activityId: string, request: RecordApplication): Promise<ActivityApplication>;
  abstract listFollowUps(ranchId: string, activityId: string): Promise<readonly ActivityFollowUp[]>;
  abstract scheduleFollowUp(ranchId: string, activityId: string, request: ScheduleFollowUp): Promise<ActivityFollowUp>;
}
