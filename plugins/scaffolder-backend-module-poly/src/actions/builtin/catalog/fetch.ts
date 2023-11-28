/*
 * Copyright 2021 The Backstage Authors
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

import { CatalogApi } from '@backstage/catalog-client';
import { TemplateFilter, TemplateGlobal, createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import { examples } from './fetch.examples';
import { createFetchCatalogEntityAction, createFetchTemplateAction } from '@backstage/plugin-scaffolder-backend';
import { resolveSafeChildPath, UrlReader } from '@backstage/backend-common';
import { ScmIntegrations } from '@backstage/integration';


const id = 'catalog:fetch';

const ParamsSchema = z.object({
  entityRef: z
    .string({
      description: 'Entity reference of the entity to get',
    })
    .optional(),
  entityRefs: z
    .array(z.string(), {
      description: 'Entity references of the entities to get',
    })
    .optional(),
  optional: z
    .boolean({
      description:
        'Allow the entity or entities to optionally exist. Default: false',
    })
    .optional(),
  defaultKind: z.string({ description: 'The default kind' }).optional(),
  defaultNamespace: z
    .string({ description: 'The default namespace' })
    .optional(),
});

const OutputSchema = z.object({
  entity: z
    .any({
      description:
        'Object containing same values used in the Entity schema. Only when used with `entityRef` parameter.',
    })
    .optional(),
  entities: z
    .array(
      z.any({
        description:
          'Array containing objects with same values used in the Entity schema. Only when used with `entityRefs` parameter.',
      }),
    )
    .optional(),
});

/**
 * Returns entity or entities from the catalog by entity reference(s).
 *
 * @public
 */
export function createPolyFetchCatalogEntityAction(options: {
  catalogClient: CatalogApi;
}) {
  
  const templateAction = createFetchCatalogEntityAction(options)

  return createTemplateAction({
    id,
    description:
      'Poly Returns entity or entities from the catalog by entity reference(s).',
    examples,
    supportsDryRun: true,
    schema: {
      input: z.object({
        commonValues: z.optional(ParamsSchema),
        values: z.array(ParamsSchema)
      }),      
      output: z.object({
        results: z.array(OutputSchema)
      })
      
    },
    async handler(ctx) {
      const {input: { values, commonValues }, output, logger} = ctx
      const results = [];

      for (const value of values) {
        logger.debug(`Fetching ${value.entityRef ?? value.entityRefs?.[0]}...`)
        const result: Record<string, any> = {}
        await templateAction.handler({ 
          ...ctx, 
          output: (k, v) => {result[k] = v},
          input: {...(commonValues ?? {}), ...value}
        });

        results.push(result);
      }
      output('results', results)
    },
  });
}
