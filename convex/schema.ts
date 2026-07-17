import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import { postMediaValidator } from './postValidators'

const storedReviewRatingBandValidator = v.union(
  v.literal('90-100'), v.literal('80-89'), v.literal('70-79'), v.literal('60-69'), v.literal('50-59'),
  v.literal('40-49'), v.literal('30-39'), v.literal('20-29'), v.literal('10-19'), v.literal('0-9'), v.literal('none'),
)

const profileVisibilityValidator = v.union(
  v.literal('public'),
  v.literal('private'),
)

const profileMediaKindValidator = v.union(
  v.literal('avatar'),
  v.literal('banner'),
)

const catalogPersonKindValidator = v.union(
  v.literal('character'),
  v.literal('staff'),
)

const catalogPersonDetailValidator = v.union(
  v.object({
    kind: v.literal('character'),
    id: v.number(),
    name: v.string(),
    nativeName: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    age: v.union(v.string(), v.null()),
    gender: v.union(v.string(), v.null()),
    birthday: v.union(v.string(), v.null()),
    bloodType: v.union(v.string(), v.null()),
  }),
  v.object({
    kind: v.literal('staff'),
    id: v.number(),
    name: v.string(),
    nativeName: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    occupations: v.array(v.string()),
    language: v.union(v.string(), v.null()),
    hometown: v.union(v.string(), v.null()),
    activeYears: v.union(v.string(), v.null()),
  }),
)

export default defineSchema({
  products: defineTable({
    title: v.string(),
    imageId: v.string(),
    price: v.number(),
  }),
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
  users: defineTable({
    authId: v.string(),
    username: v.string(),
    usernameKey: v.string(),
    name: v.string(),
    avatarStorageId: v.optional(v.id('_storage')),
    bannerStorageId: v.optional(v.id('_storage')),
    bio: v.optional(v.string()),
    profileVisibility: profileVisibilityValidator,
    visibility: v.union(
      v.literal('private'),
      v.literal('followers'),
      v.literal('public'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_username_key', ['usernameKey'])
    .index('by_avatar_storage_id', ['avatarStorageId'])
    .index('by_banner_storage_id', ['bannerStorageId']),
  userSearchDocuments: defineTable({
    userId: v.id('users'),
    searchText: v.string(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .searchIndex('search_users', {
      searchField: 'searchText',
    }),
  profileMediaUploads: defineTable({
    userId: v.id('users'),
    kind: profileMediaKindValidator,
    storageId: v.id('_storage'),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_storage', ['storageId'])
    .index('by_user', ['userId'])
    .index('by_expiry', ['expiresAt']),
  passwordResets: defineTable({
    authId: v.string(),
    tokenKey: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_token_key', ['tokenKey'])
    .index('by_expires_at', ['expiresAt']),
  authRateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    lastRequest: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_last_request', ['lastRequest']),
  otpSendLimits: defineTable({
    key: v.string(),
    claimId: v.string(),
    nextAllowedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_next_allowed_at', ['nextAllowedAt']),
  animeSummaries: defineTable({
    anilistId: v.number(),
    slug: v.string(),
    titles: v.object({
      display: v.string(),
      english: v.union(v.string(), v.null()),
      romaji: v.union(v.string(), v.null()),
      native: v.union(v.string(), v.null()),
    }),
    coverImageUrl: v.union(v.string(), v.null()),
    bannerImageUrl: v.union(v.string(), v.null()),
    format: v.union(
      v.literal('TV'),
      v.literal('TV_SHORT'),
      v.literal('MOVIE'),
      v.literal('SPECIAL'),
      v.literal('OVA'),
      v.literal('ONA'),
      v.literal('MUSIC'),
      v.null(),
    ),
    season: v.union(
      v.literal('WINTER'),
      v.literal('SPRING'),
      v.literal('SUMMER'),
      v.literal('FALL'),
      v.null(),
    ),
    seasonYear: v.union(v.number(), v.null()),
    episodes: v.union(v.number(), v.null()),
    genres: v.array(v.string()),
    popularity: v.number(),
    averageScore: v.union(v.number(), v.null()),
    trending: v.union(v.number(), v.null()),
    startDate: v.union(
      v.object({
        year: v.union(v.number(), v.null()),
        month: v.union(v.number(), v.null()),
        day: v.union(v.number(), v.null()),
      }),
      v.null(),
    ),
    nextAiringAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  }).index('by_anilist_id', ['anilistId']),
  animeDetails: defineTable({
    anilistId: v.number(),
    detail: v.object({
      anilistId: v.number(), slug: v.string(),
      titles: v.object({ display: v.string(), english: v.union(v.string(), v.null()), romaji: v.union(v.string(), v.null()), native: v.union(v.string(), v.null()) }),
      coverImageUrl: v.union(v.string(), v.null()), bannerImageUrl: v.union(v.string(), v.null()), synopsis: v.union(v.string(), v.null()),
      format: v.union(v.literal('TV'), v.literal('TV_SHORT'), v.literal('MOVIE'), v.literal('SPECIAL'), v.literal('OVA'), v.literal('ONA'), v.literal('MUSIC'), v.null()),
      status: v.union(v.literal('FINISHED'), v.literal('RELEASING'), v.literal('NOT_YET_RELEASED'), v.literal('CANCELLED'), v.literal('HIATUS'), v.null()),
      source: v.union(v.string(), v.null()), season: v.union(v.literal('WINTER'), v.literal('SPRING'), v.literal('SUMMER'), v.literal('FALL'), v.null()), seasonYear: v.union(v.number(), v.null()),
      episodes: v.union(v.number(), v.null()), durationMinutes: v.union(v.number(), v.null()),
      startDate: v.union(v.object({ year: v.union(v.number(), v.null()), month: v.union(v.number(), v.null()), day: v.union(v.number(), v.null()) }), v.null()),
      endDate: v.union(v.object({ year: v.union(v.number(), v.null()), month: v.union(v.number(), v.null()), day: v.union(v.number(), v.null()) }), v.null()),
      genres: v.array(v.string()), mainStudio: v.union(v.object({ name: v.string(), siteUrl: v.union(v.string(), v.null()) }), v.null()),
      related: v.array(v.object({ anilistId: v.number(), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()), format: v.union(v.literal('TV'), v.literal('TV_SHORT'), v.literal('MOVIE'), v.literal('SPECIAL'), v.literal('OVA'), v.literal('ONA'), v.literal('MUSIC'), v.null()), seasonYear: v.union(v.number(), v.null()) })),
      recommendations: v.array(v.object({ anilistId: v.number(), slug: v.string(), title: v.string(), coverImageUrl: v.union(v.string(), v.null()), format: v.union(v.literal('TV'), v.literal('TV_SHORT'), v.literal('MOVIE'), v.literal('SPECIAL'), v.literal('OVA'), v.literal('ONA'), v.literal('MUSIC'), v.null()), seasonYear: v.union(v.number(), v.null()) })),
      trailer: v.union(v.object({ youtubeId: v.string(), thumbnailUrl: v.union(v.string(), v.null()) }), v.null()),
      externalLinks: v.array(v.object({ site: v.string(), url: v.string() })),
      charactersPage: v.object({ items: v.array(v.object({ anilistId: v.number(), name: v.string(), role: v.union(v.literal('MAIN'), v.literal('SUPPORTING'), v.literal('BACKGROUND')), imageUrl: v.union(v.string(), v.null()), japaneseVoiceActor: v.union(v.object({ anilistId: v.number(), name: v.string(), imageUrl: v.union(v.string(), v.null()), language: v.literal('Japanese') }), v.null()) })), currentPage: v.number(), hasNextPage: v.boolean(), perPage: v.literal(24) }),
      staffPage: v.object({ items: v.array(v.object({ anilistId: v.number(), name: v.string(), role: v.string(), imageUrl: v.union(v.string(), v.null()) })), currentPage: v.number(), hasNextPage: v.boolean(), perPage: v.literal(24) }),
    }),
    refreshedAt: v.number(), expiresAt: v.number(),
  }).index('by_anilist_id', ['anilistId']),
  animeDetailPeoplePages: defineTable({
    anilistId: v.number(), kind: v.union(v.literal('characters'), v.literal('staff')), page: v.number(),
    items: v.array(v.union(
      v.object({ anilistId: v.number(), name: v.string(), role: v.union(v.literal('MAIN'), v.literal('SUPPORTING'), v.literal('BACKGROUND')), imageUrl: v.union(v.string(), v.null()), japaneseVoiceActor: v.union(v.object({ anilistId: v.number(), name: v.string(), imageUrl: v.union(v.string(), v.null()), language: v.literal('Japanese') }), v.null()) }),
      v.object({ anilistId: v.number(), name: v.string(), role: v.string(), imageUrl: v.union(v.string(), v.null()) }),
    )),
    hasNextPage: v.boolean(), refreshedAt: v.number(), expiresAt: v.number(),
  }).index('by_anime_kind_page', ['anilistId', 'kind', 'page']),
  animeDetailCacheLeases: defineTable({
    key: v.string(), leaseId: v.string(), leaseUntil: v.number(), updatedAt: v.number(),
  }).index('by_key', ['key']),
  catalogPersonDetails: defineTable({
    kind: catalogPersonKindValidator,
    personId: v.number(),
    detail: catalogPersonDetailValidator,
    refreshedAt: v.number(),
    expiresAt: v.number(),
  }).index('by_kind_person', ['kind', 'personId']),
  catalogPersonWorkPages: defineTable({
    kind: catalogPersonKindValidator,
    personId: v.number(),
    page: v.number(),
    items: v.array(v.object({
      animeId: v.number(),
      role: v.union(v.string(), v.null()),
    })),
    hasNextPage: v.boolean(),
    refreshedAt: v.number(),
    expiresAt: v.number(),
  }).index('by_kind_person_page', ['kind', 'personId', 'page']),
  catalogPersonCacheLeases: defineTable({
    key: v.string(),
    leaseId: v.string(),
    leaseUntil: v.number(),
    updatedAt: v.number(),
  }).index('by_key', ['key']),
  userAnimeEntries: defineTable({
    userId: v.id('users'), anilistId: v.number(),
    status: v.union(v.literal('watching'), v.literal('planned'), v.literal('dropped'), v.literal('completed'), v.literal('rewatched'), v.null()),
    score: v.union(v.number(), v.null()), favoriteAt: v.union(v.number(), v.null()), rewatchCount: v.number(), lastRewatchSequence: v.number(), createdAt: v.number(), updatedAt: v.number(),
  })
    .index('by_user_anime', ['userId', 'anilistId'])
    .index('by_user_status', ['userId', 'status'])
    .index('by_user_favorite_at', ['userId', 'favoriteAt']),
  userAnimeProgress: defineTable({
    userId: v.id('users'), watching: v.number(), completed: v.number(), planned: v.number(), dropped: v.number(),
  }).index('by_user', ['userId']),
  animeRewatchEntries: defineTable({
    entryId: v.id('userAnimeEntries'), userId: v.id('users'), anilistId: v.number(), completedAt: v.number(), sequence: v.number(),
  }).index('by_user_anime_sequence', ['userId', 'anilistId', 'sequence']),
  animeMilestones: defineTable({
    userId: v.id('users'), anilistId: v.number(), kind: v.union(v.literal('completed'), v.literal('rewatched')),
    visibility: v.union(v.literal('private'), v.literal('followers'), v.literal('public')),
    occurredAt: v.number(), updatedAt: v.number(),
  }).index('by_user_anime_kind', ['userId', 'anilistId', 'kind']),
  posts: defineTable({
    userId: v.id('users'), requestId: v.string(), text: v.string(), hasSpoiler: v.boolean(),
    visibility: v.union(v.literal('private'), v.literal('followers'), v.literal('public')),
    media: v.union(postMediaValidator, v.null()), createdAt: v.number(), updatedAt: v.number(),
  })
    .index('by_user_request', ['userId', 'requestId'])
    .index('by_user_created_at', ['userId', 'createdAt'])
    .index('by_created_at', ['createdAt']),
  reviews: defineTable({
    userId: v.id('users'), anilistId: v.number(), requestId: v.string(),
    state: v.union(v.literal('draft'), v.literal('published')), rating: v.union(v.number(), v.null()),
    summary: v.string(), containsSpoiler: v.boolean(), bodyJson: v.string(),
    visibility: v.union(v.literal('private'), v.literal('followers'), v.literal('public')),
    publishedAt: v.optional(v.number()), updatedAt: v.number(), activityState: v.union(v.literal('active'), v.literal('deleted')),
    newestOrderKey: v.string(), highRatingOrderKey: v.string(), lowRatingOrderKey: v.string(),
    searchText: v.string(), ratingBand: storedReviewRatingBandValidator,
  })
    .index('by_user_anime', ['userId', 'anilistId'])
    .index('by_user_request', ['userId', 'requestId'])
    .index('by_anime_state_visibility_newest', ['anilistId', 'state', 'visibility', 'newestOrderKey'])
    .index('by_anime_state_visibility_high_rating', ['anilistId', 'state', 'visibility', 'highRatingOrderKey'])
    .index('by_anime_state_visibility_low_rating', ['anilistId', 'state', 'visibility', 'lowRatingOrderKey'])
    .index('by_discovery_public_newest', ['state', 'visibility', 'newestOrderKey'])
    .index('by_discovery_public_newest_band', ['state', 'visibility', 'ratingBand', 'newestOrderKey'])
    .index('by_discovery_owner_newest', ['userId', 'state', 'visibility', 'newestOrderKey'])
    .index('by_discovery_owner_newest_band', ['userId', 'state', 'visibility', 'ratingBand', 'newestOrderKey'])
    .index('by_discovery_public_high', ['state', 'visibility', 'highRatingOrderKey'])
    .index('by_discovery_public_high_band', ['state', 'visibility', 'ratingBand', 'highRatingOrderKey'])
    .index('by_discovery_owner_high', ['userId', 'state', 'visibility', 'highRatingOrderKey'])
    .index('by_discovery_owner_high_band', ['userId', 'state', 'visibility', 'ratingBand', 'highRatingOrderKey'])
    .index('by_discovery_public_low', ['state', 'visibility', 'lowRatingOrderKey'])
    .index('by_discovery_public_low_band', ['state', 'visibility', 'ratingBand', 'lowRatingOrderKey'])
    .index('by_discovery_owner_low', ['userId', 'state', 'visibility', 'lowRatingOrderKey'])
    .index('by_discovery_owner_low_band', ['userId', 'state', 'visibility', 'ratingBand', 'lowRatingOrderKey'])
    .searchIndex('search_discovery', {
      searchField: 'searchText',
      filterFields: ['state', 'visibility', 'userId', 'ratingBand'],
    }),
  feedCards: defineTable({
    sourceKey: v.string(), kind: v.union(v.literal('post'), v.literal('review'), v.literal('completed'), v.literal('rewatched')),
    userId: v.id('users'), sourceId: v.optional(v.string()), anilistId: v.optional(v.number()),
    visibility: v.union(v.literal('private'), v.literal('followers'), v.literal('public')),
    active: v.boolean(), orderKey: v.string(), occurredAt: v.number(), updatedAt: v.number(),
  })
    .index('by_source_key', ['sourceKey'])
    .index('by_public_active_order', ['visibility', 'active', 'orderKey'])
    .index('by_user_active_order', ['userId', 'active', 'orderKey'])
    .index('by_user_source', ['userId', 'sourceKey'])
    .index('by_kind_source', ['kind', 'sourceId']),
  follows: defineTable({
    followerId: v.id('users'), followingId: v.id('users'), createdAt: v.number(),
  })
    .index('by_follower_following', ['followerId', 'followingId'])
    .index('by_following_follower', ['followingId', 'followerId']),
  animeReviewStats: defineTable({
    anilistId: v.number(), count: v.number(), ratingSum: v.number(),
    bands: v.array(v.number()), updatedAt: v.number(),
  }).index('by_anilist_id', ['anilistId']),
  discoverSectionCache: defineTable({
    key: v.union(
      v.literal('trending'),
      v.literal('seasonal'),
      v.literal('recommendations'),
      v.literal('upcoming'),
    ),
    animeIds: v.array(v.number()),
    refreshedAt: v.number(),
    expiresAt: v.number(),
  }).index('by_key', ['key']),
  discoverCacheLeases: defineTable({
    key: v.union(
      v.literal('trending'),
      v.literal('seasonal'),
      v.literal('recommendations'),
      v.literal('upcoming'),
    ),
    leaseId: v.string(),
    leaseUntil: v.number(),
    updatedAt: v.number(),
  }).index('by_key', ['key']),
  pendingOauthSignups: defineTable({
    authId: v.string(),
    providerId: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    email: v.string(),
    state: v.union(v.literal('provisional'), v.literal('oauth')),
    suggestedUsername: v.optional(v.string()),
    lastSessionExpiresAt: v.optional(v.number()),
    cleanupAfter: v.number(),
    cleanupLeaseUntil: v.optional(v.number()),
    cleanupPhase: v.optional(v.literal('deleting')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_id', ['authId'])
    .index('by_provider_account', ['providerId', 'providerAccountId'])
    .index('by_cleanup_after', ['cleanupAfter']),
})
