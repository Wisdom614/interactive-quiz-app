import { CreatorUser } from '@/types/quiz';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

const CREATOR_STORAGE_KEY = 'quizpulse_creator_user';

export class AuthService {
  public static getCurrentUser(): CreatorUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(CREATOR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  public static async signIn(email: string, name?: string): Promise<CreatorUser> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name?.trim() || cleanEmail.split('@')[0] || 'Creator';

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
        });
        if (error) console.warn('Supabase OTP sign-in warning:', error);
      } catch (err) {
        console.warn('Supabase auth catch:', err);
      }
    }

    const user: CreatorUser = {
      id: 'creator_' + Math.abs(cleanEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
      email: cleanEmail,
      name: cleanName,
      createdAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(CREATOR_STORAGE_KEY, JSON.stringify(user));
    }

    return user;
  }

  public static signInAsGuest(name: string): CreatorUser {
    const cleanName = name.trim() || 'Anonymous Creator';
    const user: CreatorUser = {
      id: 'creator_' + Math.random().toString(36).substring(2, 9),
      email: `${cleanName.toLowerCase().replace(/\s+/g, '')}@guest.quizpulse.app`,
      name: cleanName,
      createdAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(CREATOR_STORAGE_KEY, JSON.stringify(user));
    }

    return user;
  }

  public static signOut() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CREATOR_STORAGE_KEY);
      const supabase = getSupabaseClient();
      if (supabase && isSupabaseConfigured) {
        supabase.auth.signOut().catch(() => {});
      }
    }
  }
}
