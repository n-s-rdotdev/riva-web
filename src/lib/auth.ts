import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { admin, customSession, lastLoginMethod } from "better-auth/plugins";

const authOptions = {
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.userSchema,
      session: schema.sessionSchema,
      account: schema.accountSchema,
      verification: schema.verificationSchema,
    },
  }),
  user: {
    additionalFields: {
      onboarded: {
        type: "boolean",
        defaultValue: false,
      },
      accountStatus: {
        type: "string",
        defaultValue: "active",
        input: false,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  account: {
    encryptOAuthTokens: true,
    updateAccountOnSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },
  advanced: {
    cookiePrefix: env.BETTER_AUTH_SESSION_PREFIX,
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [
    lastLoginMethod({
      storeInDatabase: true,
    }),
    admin(),
    expo(),
  ],
  trustedOrigins: [
    "rivamobile://",
    // ...(process.env.NODE_ENV === "development"
    ...["exp://", "exp://**", "exp://192.168.*.*:*/**"]
    // : []),
  ],

} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),
    customSession(async ({ user, session }) => {
      return {
        user,
        session,
      };
    }, authOptions),
  ],
});
