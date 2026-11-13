import { isValidTemperatureRange } from './water-trough.model';

describe('isValidTemperatureRange', () => {
  it('accepts an ordered band inside the limits, with at most one decimal', () => {
    expect(isValidTemperatureRange({ minimumCelsius: 12.3, maximumCelsius: 24 })).toBe(true);
    expect(isValidTemperatureRange({ minimumCelsius: -10, maximumCelsius: 60 })).toBe(true);
  });

  it('rejects a minimum that is not below the maximum', () => {
    expect(isValidTemperatureRange({ minimumCelsius: 20, maximumCelsius: 20 })).toBe(false);
    expect(isValidTemperatureRange({ minimumCelsius: 25, maximumCelsius: 20 })).toBe(false);
  });

  it('rejects values outside -10 to 60 degrees Celsius', () => {
    expect(isValidTemperatureRange({ minimumCelsius: -10.1, maximumCelsius: 20 })).toBe(false);
    expect(isValidTemperatureRange({ minimumCelsius: 10, maximumCelsius: 60.1 })).toBe(false);
  });

  it('rejects more than one decimal and values that are not numbers', () => {
    expect(isValidTemperatureRange({ minimumCelsius: 12.34, maximumCelsius: 20 })).toBe(false);
    expect(isValidTemperatureRange({ minimumCelsius: Number.NaN, maximumCelsius: 20 })).toBe(false);
  });
});
