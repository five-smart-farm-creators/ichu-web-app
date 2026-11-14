import { type WaterReading, waterTemperature } from './water-status.model';

function reading(overrides: Partial<WaterReading> = {}): WaterReading {
  return {
    id: 'row-1', readingId: 'reading-1', controllerId: 'controller-1', waterTroughId: 'trough-1', ranchId: 'ranch-1',
    gatewayId: 'gateway-1', temperature: 18.4, temperatureUnit: 'Celsius', isValid: true, heaterState: 'Off',
    capturedAt: '2026-11-14T10:00:00.000000Z', receivedAt: '2026-11-14T10:00:02.000000Z', origin: 'EdgeGateway',
    ...overrides,
  };
}

describe('waterTemperature', () => {
  it('reads the temperature of a valid reading', () => {
    expect(waterTemperature(reading())).toBe(18.4);
  });

  it('reads an invalid reading as no temperature, even when the stored value is zero', () => {
    expect(waterTemperature(reading({ isValid: false, temperature: 0 }))).toBeNull();
  });
});
