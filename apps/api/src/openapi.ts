import { synthesisMetadataSchema } from '@mvs/contracts';
import { z } from 'zod';
import type { ApiRouteDefinition } from './core/providers/openapi/api-contract.decorator.js';
import { responseEntity } from './core/providers/openapi/response-entities.js';

const multipart: Record<string, string> = {
  '/chapters/:chapterId/import': 'files',
  '/pages/:pageId/replace': 'file',
  '/projects/:projectId/voices/import': 'file',
};
const headerFields: Record<string, { name: string; description: string }[]> = {
  '/pages/:pageId/replace': [
    { name: 'X-Confirm-Replace', description: 'Must be true; existing annotations are removed.' },
    { name: 'X-Expected-Revision', description: 'Current page revision.' },
  ],
  '/projects/:projectId/voices/import': [
    { name: 'X-Transcript', description: 'URI-encoded exact reference transcript.' },
    { name: 'X-Rights-Confirmed', description: 'Must be true.' },
    { name: 'X-Voice-Name', description: 'Optional URI-encoded voice name.' },
  ],
};

export function openapi(routes: ApiRouteDefinition[]) {
  const paths: Record<string, any> = {};

  for (const route of routes) {
    const { path, method, status, requestSchema } = route;
    const publicPath = path.replace(/:([\w]+)/g, '{$1}').replace('*key', '{key}');
    const parameters: any[] = [...path.matchAll(/:([\w]+)/g)].map((match) => ({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    }));

    if (path.includes('*key')) {
      parameters.push({
        name: 'key',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Private file key relative to the project.',
      });
    }

    if (!['get', 'head', 'options'].includes(method)) {
      parameters.push({ name: 'Origin', in: 'header', required: true, schema: { type: 'string', format: 'uri' } });
    }

    if (method === 'post') {
      parameters.push({
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        schema: { type: 'string', minLength: 8, maxLength: 200 },
        description: 'Required for queued operations; reuse a key to reuse the job.',
      });
    }

    for (const header of headerFields[path] || []) {
      parameters.push({ ...header, in: 'header', required: header.name !== 'X-Voice-Name', schema: { type: 'string' } });
    }

    const field = method === 'post' ? multipart[path] : undefined;
    let requestBody: any = requestSchema
      ? { required: true, content: { 'application/json': { schema: z.toJSONSchema(requestSchema) } } }
      : undefined;

    if (field) {
      requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: [field],
              properties: {
                [field]:
                  field === 'files'
                    ? { type: 'array', maxItems: 50, items: { type: 'string', format: 'binary' } }
                    : { type: 'string', format: 'binary' },
              },
            },
          },
        },
      };
    }

    const entity = route.responseSchema || responseEntity(route);
    const responses: Record<string, any> = {
      [String(status)]: {
        description: status === 202 ? 'Accepted; poll /jobs/{jobId}.' : status === 201 ? 'Created' : 'Result',
        ...(entity ? { content: { 'application/json': { schema: z.toJSONSchema(entity) } } } : {}),
      },
    };

    if (path.includes('*key')) {
      responses['200'] = { description: 'Private file; supports byte ranges.' };
      responses['206'] = { description: 'Requested byte range.' };
      parameters.push({ name: 'Range', in: 'header', required: false, schema: { type: 'string' } });
    }

    for (const [code, description] of Object.entries({
      '401': 'Authentication required',
      '403': 'Origin rejected or read-only demo',
      '404': 'Not found or not owned',
      '409': 'Revision conflict',
      '413': 'Upload too large',
      '422': 'Validation failed',
      '429': 'Rate or queue limit',
      '500': 'Internal error',
    })) {
      responses[code] = { description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } };
    }

    paths[publicPath] ??= {};
    paths[publicPath][method] = {
      summary: path,
      parameters,
      security: [{ session: [] }],
      ...(requestBody ? { requestBody } : {}),
      responses,
    };
  }

  return {
    openapi: '3.1.0',
    info: { title: 'Manga Voice Studio', version: '0.1.0' },
    servers: [{ url: '/api/v1' }],
    paths,
    components: {
      schemas: {
        SpeechSynthesis: z.toJSONSchema(synthesisMetadataSchema),
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } },
            },
          },
        },
      },
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' } },
    },
  };
}
