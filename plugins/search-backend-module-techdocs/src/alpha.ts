/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @packageDocumentation
 * A module for the search backend that exports TechDocs modules.
 */

import { loggerToWinstonLogger } from '@backstage/backend-common';
import {
  coreServices,
  createBackendModule,
  createExtensionPoint,
} from '@backstage/backend-plugin-api';
import { readTaskScheduleDefinitionFromConfig } from '@backstage/backend-tasks';
import { catalogServiceRef } from '@backstage/plugin-catalog-node/alpha';
import { DefaultTechDocsCollatorFactory } from '@backstage/plugin-search-backend-module-techdocs';
import { searchIndexRegistryExtensionPoint } from '@backstage/plugin-search-backend-node/alpha';
import { TechDocsCollatorEntityTransformer } from '@backstage/plugin-search-backend-module-techdocs';

/** @alpha */
export interface TechDocsCollatorEntityTransformerExtensionPoint {
  setTransformer(transformer: TechDocsCollatorEntityTransformer): void;
}

/**
 * Extension point used to customize the TechDocs collator entity transformer.
 *
 * @alpha
 */
export const techdocsCollatorEntityTransformerExtensionPoint =
  createExtensionPoint<TechDocsCollatorEntityTransformerExtensionPoint>({
    id: 'search.techdocsCollator.transformer',
  });

/**
 * @alpha
 * Search backend module for the TechDocs index.
 */
export default createBackendModule({
  moduleId: 'techDocsCollator',
  pluginId: 'search',
  register(env) {
    let transformer: TechDocsCollatorEntityTransformer | undefined;

    env.registerExtensionPoint(
      techdocsCollatorEntityTransformerExtensionPoint,
      {
        setTransformer(newTransformer) {
          if (transformer) {
            throw new Error(
              'TechDocs collator entity transformer may only be set once',
            );
          }
          transformer = newTransformer;
        },
      },
    );

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        discovery: coreServices.discovery,
        tokenManager: coreServices.tokenManager,
        scheduler: coreServices.scheduler,
        catalog: catalogServiceRef,
        indexRegistry: searchIndexRegistryExtensionPoint,
      },
      async init({
        config,
        logger,
        discovery,
        tokenManager,
        scheduler,
        catalog,
        indexRegistry,
      }) {
        const defaultSchedule = {
          frequency: { minutes: 10 },
          timeout: { minutes: 15 },
          initialDelay: { seconds: 3 },
        };

        const schedule = config.has('search.collators.techdocs.schedule')
          ? readTaskScheduleDefinitionFromConfig(
              config.getConfig('search.collators.techdocs.schedule'),
            )
          : defaultSchedule;

        indexRegistry.addCollator({
          schedule: scheduler.createScheduledTaskRunner(schedule),
          factory: DefaultTechDocsCollatorFactory.fromConfig(config, {
            discovery,
            tokenManager,
            logger: loggerToWinstonLogger(logger),
            catalogClient: catalog,
            entityTransformer: transformer,
          }),
        });
      },
    });
  },
});
