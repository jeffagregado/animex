import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.weekly(
  'weekly auth cleanup',
  { dayOfWeek: 'sunday', hourUTC: 3, minuteUTC: 0 },
  internal.oauthCleanupFunctions.runWeeklyCleanup,
)

export default crons
