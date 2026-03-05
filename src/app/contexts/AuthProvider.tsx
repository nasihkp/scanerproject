import { useState, useEffect, ReactNode } from "react";
import {
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    User as FirebaseUser,
    GoogleAuthProvider,
} from "firebase/auth";
import { auth, googleProvider } from "../config/firebase.config";
import { AuthContext } from "./AuthContext";
import { User } from "../types/types";

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* ================================
       AUTH STATE LISTENER
       ================================ */
    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(
            auth,
            (firebaseUser: FirebaseUser | null) => {
                if (firebaseUser) {
                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                    });
                } else {
                    setUser(null);
                }
                setLoading(false);
            }
        );

        return unsubscribe;
    }, []);

    /* ================================
       GOOGLE SIGN-IN
       ================================ */
    const signInWithGoogle = async () => {
        if (!auth || !googleProvider) {
            setError("Firebase or Google Provider is not configured. Check .env file.");
            return;
        }

        try {
            setError(null);
            setLoading(true);

            const result = await signInWithPopup(auth, googleProvider);

            // 🔥 EXTRACT & SAVE GOOGLE ACCESS TOKEN
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;

            if (token) {
                localStorage.setItem("google_access_token", token);
            }

        } catch (err: any) {
            console.error("Error signing in with Google:", err);
            setError(err.message || "Failed to sign in with Google");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    /* ================================
       SIGN OUT
       ================================ */
    const signOut = async () => {
        if (!auth) return;

        try {
            setError(null);
            await firebaseSignOut(auth);
            setUser(null);
            localStorage.removeItem("google_access_token"); // Clear token on sign out
        } catch (err: any) {
            console.error("Error signing out:", err);
            setError(err.message || "Failed to sign out");
            throw err;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                error,
                signInWithGoogle,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
