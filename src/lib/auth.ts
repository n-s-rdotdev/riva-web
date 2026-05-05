import { db } from "@/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// import * as schema from "@/db/schema";
// import { env } from "@/lib/env/server";
import { expo } from "@better-auth/expo";
import { lastLoginMethod } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    // schema: {
    //   user: schema.userSchema,
    //   session: schema.sessionSchema,
    //   account: schema.accountSchema,
    //   verification: schema.verificationSchema,
    // },
  }),
  user: {
    additionalFields: {
      onboarded: {
        type: "boolean",
        defaultValue: false,
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
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  advanced: {
    cookiePrefix: process.env.BETTER_AUTH_SESSION_PREFIX!,
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [
    lastLoginMethod({
      storeInDatabase: true,
    }),
    admin(),
    expo()
  ],
  trustedOrigins: [
    "rivamobile://",
    ...(process.env.NODE_ENV === "development"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
      : []),
  ],

});
