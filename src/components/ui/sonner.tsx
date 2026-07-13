import { Toaster as Sonner } from 'sonner'

/** Mounts AnimeX-styled app notifications. */
export function Toaster() {
  return (
    <Sonner
      closeButton
      position="bottom-right"
      theme="dark"
      toastOptions={{
        classNames: {
          actionButton: 'bg-cyan-300! text-primary-foreground! font-black!',
          cancelButton: 'bg-muted! text-muted-foreground!',
          closeButton: 'border-border! bg-card! text-muted-foreground!',
          description: 'text-muted-foreground!',
          error: 'border-red-400/50! text-foreground!',
          success: 'border-cyan-300/50! text-foreground!',
          toast: 'border-border! bg-card! text-card-foreground! shadow-2xl!',
        },
      }}
    />
  )
}
