import { cronJobs, makeFunctionReference } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()
const cleanupExpiredProfileMedia = makeFunctionReference<
  'action',
  Record<string, never>,
  null
>('profileMedia:runDailyCleanup')

crons.weekly(
  'weekly auth cleanup',
  { dayOfWeek: 'sunday', hourUTC: 3, minuteUTC: 0 },
  internal.oauthCleanupFunctions.runWeeklyCleanup,
)

crons.daily(
  'daily expired profile media cleanup',
  { hourUTC: 3, minuteUTC: 15 },
  cleanupExpiredProfileMedia,
)

export default crons
