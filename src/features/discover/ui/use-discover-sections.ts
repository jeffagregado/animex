import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { refreshDiscoverSection } from '../server/discover.functions'
import type { DiscoverPageData, DiscoverSectionKey, DiscoverSectionState } from '../shared/discover-contracts'

export type DiscoverSectionRetryProps = {
  onRetry: (key: DiscoverSectionKey) => void
  isRetrying: boolean
  retryError: string | null
}

type SectionRefresher = {
  retry: (key: DiscoverSectionKey) => void
  isPending: boolean
  isError: boolean
  error: unknown
}

type DiscoverSections = Record<DiscoverSectionKey, DiscoverSectionState | undefined>

type DiscoverSectionsResult = {
  sections: DiscoverSections
  retryProps: Record<DiscoverSectionKey, DiscoverSectionRetryProps>
}

const getRefreshErrorMessage = (error: unknown): string => error instanceof Error && error.message.length > 0 ? error.message : 'Refresh failed. Try again.'

/** Isolates pending and error state for one section refresh. */
function useSectionRefresher(onSuccess: (state: DiscoverSectionState) => void): SectionRefresher {
  const activeKey = useRef<DiscoverSectionKey | null>(null)
  const mutation = useMutation({
    mutationFn: async (key: DiscoverSectionKey) => await refreshDiscoverSection({ data: key }),
    onSuccess,
    onSettled: () => {
      activeKey.current = null
    },
  })
  const retry = (key: DiscoverSectionKey): void => {
    if (activeKey.current !== null) {
      return
    }
    activeKey.current = key
    mutation.mutate(key)
  }
  return { retry, isPending: mutation.isPending, isError: mutation.isError, error: mutation.error }
}

/** Shares hydrated section overrides and isolated retry state across pages. */
export function useDiscoverSections(data: DiscoverPageData | null | undefined, isLoading: boolean): DiscoverSectionsResult {
  const [overrides, setOverrides] = useState<Partial<Record<DiscoverSectionKey, DiscoverSectionState>>>({})
  const applyRefresh = (state: DiscoverSectionState): void => {
    const key = state.status === 'ready' ? state.section.key : state.key
    setOverrides((current) => ({ ...current, [key]: state }))
  }
  const trending = useSectionRefresher(applyRefresh)
  const seasonal = useSectionRefresher(applyRefresh)
  const recommendations = useSectionRefresher(applyRefresh)
  const upcoming = useSectionRefresher(applyRefresh)
  const resolve = (key: DiscoverSectionKey): DiscoverSectionState | undefined => isLoading ? undefined : overrides[key] ?? data?.sections[key]
  const getRetryProps = (refresh: SectionRefresher): DiscoverSectionRetryProps => ({
    onRetry: refresh.retry,
    isRetrying: refresh.isPending,
    retryError: refresh.isError ? getRefreshErrorMessage(refresh.error) : null,
  })

  return {
    sections: {
      trending: resolve('trending'),
      seasonal: resolve('seasonal'),
      recommendations: resolve('recommendations'),
      upcoming: resolve('upcoming'),
    },
    retryProps: {
      trending: getRetryProps(trending),
      seasonal: getRetryProps(seasonal),
      recommendations: getRetryProps(recommendations),
      upcoming: getRetryProps(upcoming),
    },
  }
}
