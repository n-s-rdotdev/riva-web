import { inferAdditionalFields } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        onboarded: {
          type: "boolean",
        },
        lastLoginMethod: {
          type: "string",
          required: false,
        },
        accountStatus: {
          type: "string",
          required: false,
        },
      },
    }),
  ],
})
