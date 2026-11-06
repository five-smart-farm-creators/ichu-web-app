import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { RuntimeConfig } from './core/config/runtime-config';

export function createAppConfig(config: RuntimeConfig): ApplicationConfig {
  return { providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), provideHttpClient()] };
}
