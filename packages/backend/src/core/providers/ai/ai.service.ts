import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  async run(jobId: string, kind: string, input: unknown, attemptToken: string) {
    const r = await fetch(process.env.AI_URL + '/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Secret': process.env.AI_SECRET! },
      body: JSON.stringify({ jobId, kind, input, attemptToken }),
      signal: AbortSignal.timeout(910000),
    });
    const v = (await r.json()) as any;

    if (!r.ok) {
      const e = new Error(typeof v.detail === 'string' ? v.detail : 'AI request failed') as Error & {
        status: number;
      };

      e.status = r.status;
      throw e;
    }

    return v;
  }
}
