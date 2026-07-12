/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as animeCache from "../animeCache.js";
import type * as animeCachePolicy from "../animeCachePolicy.js";
import type * as auth from "../auth.js";
import type * as authEmailDelivery from "../authEmailDelivery.js";
import type * as authEmails from "../authEmails.js";
import type * as authFailureLog from "../authFailureLog.js";
import type * as authNotices from "../authNotices.js";
import type * as authOAuthHandlers from "../authOAuthHandlers.js";
import type * as authOrchestration from "../authOrchestration.js";
import type * as authRateLimits from "../authRateLimits.js";
import type * as authSecurity from "../authSecurity.js";
import type * as authVerificationCleanup from "../authVerificationCleanup.js";
import type * as avatarImport from "../avatarImport.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as oauthCleanup from "../oauthCleanup.js";
import type * as oauthCleanupFunctions from "../oauthCleanupFunctions.js";
import type * as oauthLifecycle from "../oauthLifecycle.js";
import type * as otpCooldown from "../otpCooldown.js";
import type * as otpSendLimits from "../otpSendLimits.js";
import type * as passwordResets from "../passwordResets.js";
import type * as pendingOauthSignups from "../pendingOauthSignups.js";
import type * as todos from "../todos.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  animeCache: typeof animeCache;
  animeCachePolicy: typeof animeCachePolicy;
  auth: typeof auth;
  authEmailDelivery: typeof authEmailDelivery;
  authEmails: typeof authEmails;
  authFailureLog: typeof authFailureLog;
  authNotices: typeof authNotices;
  authOAuthHandlers: typeof authOAuthHandlers;
  authOrchestration: typeof authOrchestration;
  authRateLimits: typeof authRateLimits;
  authSecurity: typeof authSecurity;
  authVerificationCleanup: typeof authVerificationCleanup;
  avatarImport: typeof avatarImport;
  crons: typeof crons;
  http: typeof http;
  oauthCleanup: typeof oauthCleanup;
  oauthCleanupFunctions: typeof oauthCleanupFunctions;
  oauthLifecycle: typeof oauthLifecycle;
  otpCooldown: typeof otpCooldown;
  otpSendLimits: typeof otpSendLimits;
  passwordResets: typeof passwordResets;
  pendingOauthSignups: typeof pendingOauthSignups;
  todos: typeof todos;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
