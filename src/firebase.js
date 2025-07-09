// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCbWZavly9OKYn6CaYAg-EbZ4aLs7QIksE",
  authDomain: "falaai-87dad.firebaseapp.com",
  databaseURL: "https://falaai-87dad-default-rtdb.firebaseio.com",
  projectId: "falaai-87dad",
  storageBucket: "falaai-87dad.appspot.com",
  messagingSenderId: "464855767324",
  appId: "1:464855767324:web:446cfe2bfafc7949c742d9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);