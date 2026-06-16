import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

const projectId = process.env.FIREBASE_PROJECT_ID || "xcode-assist-ui-202606";

if (getApps().length === 0) {
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountVar) {
    try {
      const credential = serviceAccountVar.trim().startsWith("{")
        ? cert(JSON.parse(serviceAccountVar))
        : cert(serviceAccountVar);
      
      initializeApp({
        credential,
        projectId,
      });
    } catch (err) {
      console.warn("Could not load FIREBASE_SERVICE_ACCOUNT credentials, falling back to default:", err);
      initializeApp({ projectId });
    }
  } else {
    initializeApp({ projectId });
  }
}

export const db = getFirestore();

export async function connectDB() {
  console.log(`Firebase Admin SDK initialized. Project ID: ${projectId}`);
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
    const docRef = db.collection("users").doc(lowerEmail);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data) {
        return new User({ email: data.email, password: data.password });
      }
    }
    return null;
  }

  async save() {
    let finalPassword = this.password;
    if (finalPassword.length !== 64) {
      finalPassword = hashPassword(finalPassword);
    }
    const docRef = db.collection("users").doc(this.email);
    await docRef.set({
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
      const querySnapshot = await db
        .collection("conversations")
        .where("email", "==", this.email)
        .get();

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
    const docId = `${filter.email.replace(/[^a-zA-Z0-9]/g, "_")}_${filter.id}`;
    const docRef = db.collection("conversations").doc(docId);
    await docRef.set(update, { merge: true });
    return update;
  }

  static async deleteOne(filter: { id: string; email: string }) {
    const docId = `${filter.email.replace(/[^a-zA-Z0-9]/g, "_")}_${filter.id}`;
    const docRef = db.collection("conversations").doc(docId);
    await docRef.delete();
    return { deletedCount: 1 };
  }
}
