import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCbtrEj3dy81a3SopSLqoOXJ1vD-SrHWSk',
  authDomain: 'aura-45b67.firebaseapp.com',
  projectId: 'aura-45b67',
  storageBucket: 'aura-45b67.firebasestorage.app',
  messagingSenderId: '398885527729',
  appId: '1:398885527729:web:91bb0383d3207c37304290',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);