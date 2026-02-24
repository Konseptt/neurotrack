import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type RegionName = 
  | 'Left temple'
  | 'Right temple'
  | 'Forehead'
  | 'Behind left eye'
  | 'Behind right eye'
  | 'Back of head'
  | 'Neck base';

export interface RegionLog {
  region_name: RegionName;
  intensity: number; // 0 to 10
}

export interface MigraineSession {
  id: string;
  user_id: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  notes: string;
  regions: RegionLog[];
}

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface RegionFrequency {
  region: RegionName;
  count: number;
  avgIntensity: number;
}

/** Validates email format */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface AppState {
  currentUser: User | null;
  sessions: MigraineSession[];
  login: (email: string) => string | null;
  logout: () => void;
  addSession: (session: Omit<MigraineSession, 'id' | 'user_id'>) => void;
  deleteSession: (id: string) => void;
}

/** Compute region frequency analytics from sessions */
export function computeRegionFrequency(sessions: MigraineSession[]): RegionFrequency[] {
  const regionMap = new Map<RegionName, { count: number; totalIntensity: number }>();
  
  sessions.forEach(session => {
    session.regions.forEach(r => {
      const existing = regionMap.get(r.region_name) || { count: 0, totalIntensity: 0 };
      existing.count += 1;
      existing.totalIntensity += r.intensity;
      regionMap.set(r.region_name, existing);
    });
  });

  return Array.from(regionMap.entries())
    .map(([region, data]) => ({
      region,
      count: data.count,
      avgIntensity: data.count > 0 ? Math.round((data.totalIntensity / data.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      sessions: [],
      login: (email: string) => {
        if (!isValidEmail(email)) {
          return 'Please enter a valid email address.';
        }
        const user: User = {
          id: uuidv4(),
          email,
          created_at: new Date().toISOString(),
        };
        set({ currentUser: user });
        return null;
      },
      logout: () => {
        set({ currentUser: null });
      },
      addSession: (sessionData) => {
        const { currentUser, sessions } = get();
        if (!currentUser) return;
        
        const newSession: MigraineSession = {
          ...sessionData,
          id: uuidv4(),
          user_id: currentUser.id,
        };
        
        set({ sessions: [...sessions, newSession] });
      },
      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        }));
      },
    }),
    {
      name: 'neurotrack-storage',
    }
  )
);
