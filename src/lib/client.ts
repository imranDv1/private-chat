import { treaty } from '@elysiajs/eden'
import type { App } from '../app/api/[[...slugs]]/route'

// .api to enter /api prefix
export const client  = treaty<App>('https://private-chat-umber.vercel.app').api





