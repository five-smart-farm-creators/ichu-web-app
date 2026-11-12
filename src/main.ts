import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { loadRuntimeConfig, warmUpApi } from './app/core/config/runtime-config';

loadRuntimeConfig()
  .then(config => {
    warmUpApi(config);
    return bootstrapApplication(App, createAppConfig(config));
  })
  .catch(() => console.error('The ICHU application could not start.'));
