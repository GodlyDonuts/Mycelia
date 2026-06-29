"use client"

// Firebase client — real identity for the demo. Email/password sign-in happens
// here in the browser; the resulting Firebase ID token is sent to
// /api/auth/login, verified server-side (lib/firebase-verify.ts), and exchanged
// for the existing HMAC session cookie that carries the app role. So Firebase is
// the identity layer and the role/economics model underneath is unchanged.
//
// The web config is a public identifier (not a secret — access is gated by
// Firebase auth rules + authorized domains), so shipping it to the client is
// expected. NEXT_PUBLIC_* env vars override it for other projects/deploys.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCCiK14HI1qvypVtM_VO7CDmgYDblyIy-o",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "h0-30360.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "h0-30360",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "h0-30360.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "958310425773",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:958310425773:web:6423879708364e2c0d9224",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-0PX3QC24VE",
}

/** The project id the server must check the ID token's audience against. */
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth: Auth = getAuth(firebaseApp)

/** Analytics is browser-only and optional; never let it break SSR or sign-in. */
export async function initAnalytics(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics")
    if (await isSupported()) getAnalytics(firebaseApp)
  } catch {
    /* analytics is non-essential */
  }
}
