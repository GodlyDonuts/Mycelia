// Server-side Firebase ID-token verification — WITHOUT the Admin SDK or a
// service-account secret. Firebase ID tokens are RS256 JWTs signed by Google;
// we verify the signature against Google's published public keys (JWKS) and
// check the issuer/audience are this project. That's a real cryptographic check
// the client can't forge — enough to trust the identity before issuing a session.

import { createRemoteJWKSet, jwtVerify } from "jose"

// Google's public keys for Firebase Secure Token Service, in JWKS form.
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
)

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "h0-30360"

export interface FirebaseIdentity {
  uid: string
  email: string | null
  name: string | null
  picture: string | null
}

/** Verify a Firebase ID token; returns the identity, or null if invalid. */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity | null> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ["RS256"],
    })
    const sub = typeof payload.sub === "string" ? payload.sub : null
    if (!sub) return null
    return {
      uid: sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    }
  } catch {
    return null
  }
}
