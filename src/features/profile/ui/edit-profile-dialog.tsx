import { useEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { revalidateLogic, useForm } from '@tanstack/react-form'
import { useMutation } from 'convex/react'
import { makeFunctionReference } from 'convex/server'
import { XIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  getAuthFieldError,
  getAuthSchemaErrors,
  submitAuthForm,
} from '#/features/auth/auth-form'
import {
  profileEditInputSchema as profileEditSchema,
  type ProfileVisibility,
} from '../shared/profile-contracts'

type ProfileEditFormValues = {
  name: string
  bio: string | null
  profileVisibility: ProfileVisibility
}

type EditableProfile = ProfileEditFormValues & {
  id: string
}

interface EditProfileDialogProps {
  finalFocus: HTMLElement | null
  onOpenChange: (open: boolean) => void
  open: boolean
  profile: EditableProfile
}

type ProfileEditField = keyof ProfileEditFormValues
type ProfileEditFieldErrors = Partial<Record<ProfileEditField, string>>
type ProfileUpdateArgs = {
  name: string
  bio: string
  profileVisibility: ProfileVisibility
}

interface ProfileEditErrorData {
  code: 'PROFILE_EDIT_INVALID'
  message: string
  fieldErrors: ProfileEditFieldErrors
}

const profileUpdate = makeFunctionReference<
  'mutation',
  ProfileUpdateArgs,
  null
>('profiles:update')

const profileFields: readonly ProfileEditField[] = [
  'name',
  'bio',
  'profileVisibility',
]

/** Selects fields managed by Profile edit form. */
const toProfileEditValues = (
  profile: EditableProfile,
): ProfileEditFormValues => ({
  name: profile.name,
  bio: profile.bio,
  profileVisibility: profile.profileVisibility,
})

/** Reads the stable Profile validation payload from a mutation error. */
const getProfileEditError = (error: unknown): ProfileEditErrorData | null => {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null
  const data = error.data
  if (typeof data !== 'object' || data === null) return null
  if (
    !('code' in data)
    || data.code !== 'PROFILE_EDIT_INVALID'
    || !('message' in data)
    || typeof data.message !== 'string'
    || !('fieldErrors' in data)
    || typeof data.fieldErrors !== 'object'
    || data.fieldErrors === null
  ) return null
  return data as ProfileEditErrorData
}

/** Focuses the first editable invalid Profile control. */
const focusFirstInvalidProfileField = (form: HTMLFormElement | null): void => {
  if (!form) return
  for (const name of profileFields) {
    const control = form.elements.namedItem(name)
    if (!(control instanceof HTMLElement)) continue
    if (control.getAttribute('aria-invalid') !== 'true') continue
    control.focus()
    return
  }
}

/** Renders the owner Profile text and visibility editor. */
export function EditProfileDialog({
  finalFocus,
  onOpenChange,
  open,
  profile,
}: EditProfileDialogProps) {
  const updateProfile = useMutation(profileUpdate)
  const formRef = useRef<HTMLFormElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const activeProfileIdRef = useRef(profile.id)
  const wasOpenRef = useRef(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [submitErrors, setSubmitErrors] = useState<ProfileEditFieldErrors>({})
  const [serverErrors, setServerErrors] = useState<ProfileEditFieldErrors>({})

  const form = useForm({
    defaultValues: toProfileEditValues(profile),
    validationLogic: revalidateLogic({
      mode: 'blur',
      modeAfterSubmission: 'change',
    }),
    validators: {
      onDynamic: profileEditSchema,
    },
    onSubmit: async ({ value }) => {
      setMessage(null)
      setServerErrors({})
      setSaving(true)
      try {
        const input = profileEditSchema.parse(value)
        await updateProfile({
          name: input.name,
          bio: input.bio ?? '',
          profileVisibility: input.profileVisibility,
        })
        onOpenChange(false)
      } catch (error) {
        const validation = getProfileEditError(error)
        if (validation) {
          setServerErrors(validation.fieldErrors)
          setMessage(validation.message)
          window.setTimeout(
            () => focusFirstInvalidProfileField(formRef.current),
            0,
          )
        } else {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Profile update failed. Retry the save.',
          )
        }
      } finally {
        setSaving(false)
      }
    },
  })

  useEffect(() => {
    const opened = open && !wasOpenRef.current
    const profileChanged = open && activeProfileIdRef.current !== profile.id
    if (opened || profileChanged) {
      form.reset(toProfileEditValues(profile))
      setSubmitted(false)
      setSubmitErrors({})
      setServerErrors({})
      setMessage(null)
    }
    activeProfileIdRef.current = profile.id
    wasOpenRef.current = open
  }, [form, open, profile.id])

  const changeOpen = (nextOpen: boolean): void => {
    if (!nextOpen && saving) return
    onOpenChange(nextOpen)
  }

  return (
    <DialogPrimitive.Root onOpenChange={changeOpen} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:duration-0"
          data-testid="edit-profile-backdrop"
        />
        <DialogPrimitive.Popup
          aria-busy={saving}
          className="scrollbar-themed fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(94vw,42rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-card p-5 shadow-2xl duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:duration-0 sm:p-7"
          finalFocus={() => finalFocus}
          initialFocus={nameRef}
        >
          <DialogPrimitive.Title className="pr-12 text-2xl font-black">
            Edit Profile
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            Update the identity and Profile Visibility shown on AnimeX.
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            aria-label="Close Edit Profile"
            className="absolute top-3 right-3 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-cyan-300/10 hover:text-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-wait disabled:opacity-50"
            disabled={saving}
          >
            <XIcon aria-hidden="true" />
          </DialogPrimitive.Close>

          <form
            ref={formRef}
            className="mt-6 flex flex-col gap-5"
            noValidate
            onSubmit={(event) => submitAuthForm(event, () => {
              setSubmitted(true)
              setMessage(null)
              setServerErrors({})
              const errors = getAuthSchemaErrors(
                profileEditSchema,
                form.state.values,
              ) as ProfileEditFieldErrors
              setSubmitErrors(errors)
              if (Object.keys(errors).length > 0) {
                window.setTimeout(
                  () => focusFirstInvalidProfileField(formRef.current),
                  0,
                )
                return
              }
              void form.handleSubmit()
            })}
          >
            <form.Field
              name="name"
              children={(field) => {
                const error = serverErrors.name
                  ?? (submitted
                    ? submitErrors.name ?? null
                    : getAuthFieldError(field.state.meta.errors))
                return (
                  <label className="flex flex-col gap-2 font-bold">
                    <span>Display name</span>
                    <Input
                      ref={nameRef}
                      aria-describedby={error ? 'profile-name-error' : undefined}
                      aria-invalid={error ? true : undefined}
                      autoComplete="name"
                      disabled={saving}
                      maxLength={50}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        const name = event.target.value
                        setServerErrors((current) => ({
                          ...current,
                          name: undefined,
                        }))
                        field.handleChange(name)
                        if (submitted) {
                          setSubmitErrors(getAuthSchemaErrors(
                            profileEditSchema,
                            { ...form.state.values, name },
                          ))
                        }
                      }}
                    />
                    {error ? (
                      <span
                        className="text-sm font-medium text-destructive"
                        id="profile-name-error"
                      >
                        {error}
                      </span>
                    ) : null}
                  </label>
                )
              }}
            />

            <form.Field
              name="bio"
              children={(field) => {
                const error = serverErrors.bio
                  ?? (submitted
                    ? submitErrors.bio ?? null
                    : getAuthFieldError(field.state.meta.errors))
                return (
                  <label className="flex flex-col gap-2 font-bold">
                    <span>Bio</span>
                    <textarea
                      aria-describedby={error ? 'profile-bio-error' : undefined}
                      aria-invalid={error ? true : undefined}
                      className="min-h-28 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm font-normal outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/40 disabled:cursor-wait disabled:opacity-50"
                      disabled={saving}
                      maxLength={300}
                      name={field.name}
                      value={field.state.value ?? ''}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        const bio = event.target.value
                        setServerErrors((current) => ({
                          ...current,
                          bio: undefined,
                        }))
                        field.handleChange(bio)
                        if (submitted) {
                          setSubmitErrors(getAuthSchemaErrors(
                            profileEditSchema,
                            { ...form.state.values, bio },
                          ))
                        }
                      }}
                    />
                    {error ? (
                      <span
                        className="text-sm font-medium text-destructive"
                        id="profile-bio-error"
                      >
                        {error}
                      </span>
                    ) : null}
                  </label>
                )
              }}
            />

            <form.Field
              name="profileVisibility"
              children={(field) => {
                const error = serverErrors.profileVisibility
                  ?? (submitted
                    ? submitErrors.profileVisibility ?? null
                    : getAuthFieldError(field.state.meta.errors))
                return (
                  <label className="flex flex-col gap-2 font-bold">
                    <span>Profile Visibility</span>
                    <select
                      aria-describedby={error ? 'profile-visibility-error' : undefined}
                      aria-invalid={error ? true : undefined}
                      className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/40 disabled:cursor-wait disabled:opacity-50"
                      disabled={saving}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        const visibility = event.target.value as ProfileVisibility
                        setServerErrors((current) => ({
                          ...current,
                          profileVisibility: undefined,
                        }))
                        field.handleChange(visibility)
                      }}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <span className="text-sm font-normal text-muted-foreground">
                      Private profiles show identity only to other signed-in users.
                    </span>
                    {error ? (
                      <span
                        className="text-sm font-medium text-destructive"
                        id="profile-visibility-error"
                      >
                        {error}
                      </span>
                    ) : null}
                  </label>
                )
              }}
            />

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 font-bold">Profile media</legend>
              <Button disabled type="button" variant="outline">
                Change avatar
              </Button>
              <Button disabled type="button" variant="outline">
                Change banner
              </Button>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Avatar and banner editing arrive in the next Profile step.
              </p>
            </fieldset>

            {message ? (
              <p
                aria-live="assertive"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {message}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Button
                disabled={saving}
                onClick={() => changeOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? 'Saving changes…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
