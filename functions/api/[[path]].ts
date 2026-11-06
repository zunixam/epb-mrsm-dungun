import type { PagesFunction } from '@cloudflare/workers-types';
import { handleApi, type Env } from '../../server/api';
export const onRequest:PagesFunction<Env> = context => handleApi(context.request as unknown as Request,context.env) as unknown as ReturnType<PagesFunction<Env>>;
