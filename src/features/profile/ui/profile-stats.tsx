import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CirclePlayIcon,
  XCircleIcon,
} from 'lucide-react'

interface ProfileStatsData {
  completed: number
  watching: number
  planned: number
  dropped: number
}

const stats = [
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle2Icon,
    color: 'text-cyan-300',
  },
  {
    key: 'watching',
    label: 'Watching',
    icon: CirclePlayIcon,
    color: 'text-sky-300',
  },
  {
    key: 'planned',
    label: 'Planned',
    icon: CalendarClockIcon,
    color: 'text-slate-300',
  },
  {
    key: 'dropped',
    label: 'Dropped',
    icon: XCircleIcon,
    color: 'text-coral-400',
  },
] as const

/** Shows the four approved List Progress counts. */
export function ProfileStats({ progress }: { progress: ProfileStatsData }) {
  return (
    <section
      aria-labelledby="profile-progress-heading"
      className="rounded-xl border border-white/10 bg-card/60 p-5"
    >
      <h2 id="profile-progress-heading" className="font-black">
        List Progress
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ key, label, icon: Icon, color }) => (
          <div
            className="grid place-items-center rounded-lg border border-white/8 bg-black/15 p-3 text-center"
            key={key}
          >
            <Icon aria-hidden="true" className={`size-6 ${color}`} />
            <dd className="mt-2 text-2xl font-black tabular-nums">
              {progress[key]}
            </dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}
