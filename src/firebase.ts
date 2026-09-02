import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

if (!firebaseConfigured) {
  console.warn(
    "[firebase] .env에 VITE_FIREBASE_* 값이 설정되지 않았습니다. " +
      "순위표 저장/조회 기능이 동작하지 않습니다. .env.example을 참고하세요.",
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
