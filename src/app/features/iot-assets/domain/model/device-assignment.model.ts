/** What a device serves; WaterTrough is kept only so API responses for other device families still parse. */
export type AssignmentTargetType = 'Cattle' | 'WaterTrough';

/** One period during which a device served a target; closed periods keep their release reason as history. */
export interface DeviceAssignment {
  readonly id: string;
  readonly deviceId: string;
  readonly ranchId: string;
  readonly targetId: string;
  readonly targetType: AssignmentTargetType;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly releaseReason: string | null;
}
