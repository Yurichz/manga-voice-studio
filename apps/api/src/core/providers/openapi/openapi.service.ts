import { Inject, Injectable } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { openapi } from '../../../openapi.js';
import { API_CONTRACT, type ApiRouteDefinition } from './api-contract.decorator.js';

@Injectable()
export class OpenApiService {
  constructor(
    @Inject(ModulesContainer)
    private readonly modules: ModulesContainer,
  ) {}

  document() {
    const routes: ApiRouteDefinition[] = [];

    for (const module of this.modules.values()) {
      for (const wrapper of module.controllers.values()) {
        const prototype = wrapper.metatype?.prototype;

        if (!prototype) {
          continue;
        }

        for (const name of Object.getOwnPropertyNames(prototype)) {
          const contract = Reflect.getMetadata(API_CONTRACT, prototype[name]) as ApiRouteDefinition | undefined;

          if (contract) {
            routes.push(contract);
          }
        }
      }
    }

    return openapi(routes);
  }
}
