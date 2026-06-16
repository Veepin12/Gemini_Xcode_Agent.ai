import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "xcode-assist-ui-202606",
  appId: "1:374185040168:web:981e9f646305b71a6a981d",
  storageBucket: "xcode-assist-ui-202606.firebasestorage.app",
  apiKey: "AIzaSyCQ1C5ZW3XUUrPA2avPZEqu3N4XUWOycYc",
  authDomain: "xcode-assist-ui-202606.firebaseapp.com",
  messagingSenderId: "374185040168",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
