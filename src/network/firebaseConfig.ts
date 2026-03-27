import { getAuth, signInAnonymously } from "firebase/auth";
import { initializeApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getDatabase } from "firebase/database";

const env = import.meta.env as Record<string, string | boolean | undefined>;

function readRequiredEnv(name: string) {
  const value = env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required Firebase env variable: ${name}`);
  }
  return value;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: readRequiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  databaseURL: readRequiredEnv("VITE_FIREBASE_DATABASE_URL"),
  projectId: readRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readRequiredEnv("VITE_FIREBASE_APP_ID"),
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

let appCheckInitialized = false;

function initAppCheckIfConfigured() {
  if (appCheckInitialized) return;

  const siteKey = env["VITE_FIREBASE_APP_CHECK_SITE_KEY"];
  if (typeof siteKey !== "string" || siteKey.trim().length === 0) {
    return;
  }

  const debugToken = env["VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN"];
  if (
    import.meta.env.DEV &&
    typeof debugToken === "string" &&
    debugToken.trim().length > 0
  ) {
    (
      globalThis as typeof globalThis & {
        FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
      }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === "true" ? true : debugToken;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  appCheckInitialized = true;
}

initAppCheckIfConfigured();

const authReady = signInAnonymously(auth)
  .then(() => {
    return;
  })
  .catch((error) => {
    console.error("Failed to sign in anonymously", error);
    throw error;
  });

async function ensureFirebaseReady() {
  await authReady;
}

export { app, auth, database, ensureFirebaseReady };
