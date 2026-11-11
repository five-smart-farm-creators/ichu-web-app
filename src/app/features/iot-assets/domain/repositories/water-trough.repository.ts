import type { ConfigureTemperatureRange, RegisterWaterTrough, WaterTrough } from '../model/water-trough.model';

/** Defines water trough operations backed by the water troughs REST API; every call is scoped to one ranch. */
export abstract class WaterTroughRepository {
  abstract list(ranchId: string): Promise<readonly WaterTrough[]>;
  abstract register(ranchId: string, request: RegisterWaterTrough): Promise<WaterTrough>;
  abstract configureTemperatureRange(
    ranchId: string,
    waterTroughId: string,
    request: ConfigureTemperatureRange,
  ): Promise<WaterTrough>;
}
