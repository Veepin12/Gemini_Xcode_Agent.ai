import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from "firebase/firestore";
import crypto from "crypto";

const firebaseConfig = {
  projectId: "xcode-assist-ui-202606",
  appId: "1:374185040168:web:981e9f646305b71a6a981d",
  storageBucket: "xcode-assist-ui-202606.firebasestorage.app",
  apiKey: "AIzaSyCQ1C5ZW3XUUrPA2avPZEqu3N4XUWOycYc",
  authDomain: "xcode-assist-ui-202606.firebaseapp.com",
  messagingSenderId: "374185040168",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function connectDB() {
  console.log("Firebase/Firestore connection initialized for local server.");
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export class User {
  email: string;
  password: string;

  constructor({ email, password }: { email: string; password: string }) {
    this.email = email.toLowerCase();
    this.password = password;
  }

  static async findOne({ email }: { email: string }) {
    if (!email) return null;
    const lowerEmail = email.toLowerCase();
    const docRef = doc(db, "users", lowerEmail);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return new User({ email: data.email, password: data.password });
    }
    return null;
  }

  async save() {
    let finalPassword = this.password;
    // Hash password before saving if it's not already a SHA-256 hash (64 hex characters)
    if (finalPassword.length !== 64) {
      finalPassword = hashPassword(finalPassword);
    }
    const docRef = doc(db, "users", this.email);
    await setDoc(docRef, {
      email: this.email,
      password: finalPassword,
    });
    return this;
  }
}

class ConversationQuery {
  private email: string;
  private sortField: string = "timestamp";
  private sortOrder: number = -1; // -1 for desc, 1 for asc

  constructor(email: string) {
    this.email = email.toLowerCase();
  }

  sort(sortObj: { [key: string]: number }) {
    const field = Object.keys(sortObj)[0];
    if (field) {
      this.sortField = field;
      this.sortOrder = sortObj[field];
    }
    return this;
  }

  async then(onfulfilled?: (value: any[]) => any, onrejected?: (reason: any) => any) {
    try {
      const q = query(
        collection(db, "conversations"),
        where("email", "==", this.email)
      );
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      querySnapshot.forEach((doc) => {
        results.push(doc.data());
      });

      // Sort in-memory based on timestamp
      results.sort((a, b) => {
        const valA = a[this.sortField] || 0;
        const valB = b[this.sortField] || 0;
        if (valA < valB) return -1 * this.sortOrder;
        if (valA > valB) return 1 * this.sortOrder;
        return 0;
      });

      if (onfulfilled) {
        return onfulfilled(results);
      }
      return results;
    } catch (err) {
      if (onrejected) {
        return onrejected(err);
      }
      throw err;
    }
  }
}

export class Conversation {
  static find({ email }: { email: string }) {
    return new ConversationQuery(email);
  }

  static async findOneAndUpdate(
    filter: { id: string; email: string },
    update: any,
    options?: { upsert?: boolean; new?: boolean }
  ) {
    // Generate a sanitized document ID for Firestore
    const docId = `${filter.email.replace(/[^a-zA-Z0-9]/g, "_")}_${filter.id}`;
    const docRef = doc(db, "conversations", docId);
    
    // Write/update the document
    await setDoc(docRef, update, { merge: true });
    return update;
  }

  static async deleteOne(filter: { id: string; email: string }) {
    const docId = `${filter.email.replace(/[^a-zA-Z0-9]/g, "_")}_${filter.id}`;
    const docRef = doc(db, "conversations", docId);
    await deleteDoc(docRef);
    return { deletedCount: 1 };
  }
}
