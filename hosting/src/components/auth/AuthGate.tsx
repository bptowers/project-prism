import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { isAllowedEmail } from '@/lib/allowedDomains';

/**
 * Gates the entire app behind a verified company-domain Google sign-in.
 * Replaces the previous anonymous-auth model. The authoritative access
 * controls are the Firestore/Storage rules and the backend requireAuth; the
 * checks here are the user-facing gate + defence-in-depth.
 *
 * Children (the dashboard + its data hooks) mount only once an allowed user is
 * present, so Firestore reads no longer race an unresolved anonymous session.
 */

const centered: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-display)',
  padding: '2rem',
  textAlign: 'center',
};

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      // A lingering session from a non-allowed account: sign it out.
      if (u && !(isAllowedEmail(u.email) && u.emailVerified)) {
        setError("That account isn't authorised — sign in with your Simpro or BigChange account.");
        signOut(auth).catch(() => undefined);
        setUser(null);
      } else {
        setUser(u);
        if (u) setError(null);
      }
      setResolving(false);
    });
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      // Defence-in-depth: reject a non-allowed account immediately (rules and
      // requireAuth would deny it anyway, but this gives a clear message).
      if (!(isAllowedEmail(cred.user.email) && cred.user.emailVerified)) {
        await signOut(auth);
        setError("That account isn't authorised — sign in with your Simpro or BigChange account.");
      }
    } catch (err) {
      // Popup blocked/closed or network error. signInWithRedirect is the
      // fallback if popups become a problem in this environment.
      setError(`Sign-in failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSigningIn(false);
    }
  };

  if (resolving) {
    return <div style={centered}><span style={{ color: 'var(--text-muted)' }}>Loading…</span></div>;
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <div style={centered}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Project Prism</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
        Revenue Intelligence Engine. Sign in with your company Google account to continue.
      </p>
      <button
        onClick={handleSignIn}
        disabled={signingIn}
        style={{
          marginTop: '0.5rem',
          padding: '0.65rem 1.25rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          fontSize: '0.9rem',
          fontWeight: 600,
          cursor: signingIn ? 'default' : 'pointer',
          opacity: signingIn ? 0.6 : 1,
        }}
      >
        {signingIn ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && (
        <p style={{ color: 'var(--error)', maxWidth: 360, margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}>
          {error}
        </p>
      )}
    </div>
  );
};
