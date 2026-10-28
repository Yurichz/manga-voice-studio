import { createHash } from 'node:crypto';
import { preparedSpeechSchema } from './index.js';

export async function prepareSpeechTexts(texts: string[], language: string) {
  if (!texts.length) {
    return [];
  }

  const prepared = [];

  for (let i = 0; i < texts.length; i += 500) {
    const batch = texts.slice(i, i + 500);
    const response = await fetch((process.env.AI_URL || 'http://127.0.0.1:8001') + '/prepare-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Secret': process.env.AI_SECRET! },
      body: JSON.stringify({ texts: batch, language }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);

      throw Object.assign(
        new Error(typeof body?.detail === 'string' ? body.detail : 'Подготовка текста недоступна. Проверьте AI-сервис.'),
        { status: response.status },
      );
    }

    const values = preparedSpeechSchema
      .array()
      .length(batch.length)
      .parse(await response.json());

    prepared.push(...values);
  }

  return prepared;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonical).join(',') + ']';
  }

  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  }

  return JSON.stringify(value);
}
export function inputHash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
