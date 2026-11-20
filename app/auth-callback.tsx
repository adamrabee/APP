import { Redirect } from 'expo-router';

/** Google sign-in returns here (meapp://auth-callback); the session is handled in lib/auth. */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
