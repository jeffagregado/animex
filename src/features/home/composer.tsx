import { ImagePlus, Send } from 'lucide-react'

export function Composer() {
  return (
    <section className="panel flex items-center gap-3 p-3" aria-label="Post composer preview">
      <div className="avatar">AF</div>
      <div className="min-w-0 flex-1 text-base text-muted-foreground">What are you watching?</div>
      <button className="icon-button text-cyan-300" type="button" aria-label="Attach image">
        <ImagePlus aria-hidden="true" className="size-5" />
      </button>
      <button className="icon-button text-cyan-300" type="button" aria-label="Send post">
        <Send aria-hidden="true" className="size-5" />
      </button>
    </section>
  )
}
