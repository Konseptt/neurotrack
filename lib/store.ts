import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type RegionName =
  | 'Frontal (Forehead)'
  | 'Vertex (Crown)'
  | 'Left Temporal'
  | 'Right Temporal'
  | 'Left Parietal'
  | 'Right Parietal'
  | 'Left Periorbital'
  | 'Right Periorbital'
  | 'Left Sinus / Maxillary'
  | 'Right Sinus / Maxillary'
  | 'Left Auricular'
  | 'Right Auricular'
  | 'Occipital (Back of Skull)'
  | 'Suboccipital (Base of Skull)'
  | 'Cervicogenic (Neck)';

export type PainType =
  | 'Pulsating'
  | 'Stabbing'
  | 'Pressing'
  | 'Burning'
  | 'Throbbing'
  | 'Shooting'
  | 'Squeezing'
  | 'Dull Ache';

export interface RegionLog {
  region_name: RegionName;
  intensity: number; // 0 to 10
  pain_types: PainType[];
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

interface AppState {
  currentUser: User | null;
  sessions: MigraineSession[];
  login: (email: string) => void;
  logout: () => void;
  addSession: (session: Omit<MigraineSession, 'id' | 'user_id'>) => void;
  deleteSession: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      sessions: [],
      login: (email: string) => {
        // Simple mock login
        const user: User = {
          id: uuidv4(),
          email,
          created_at: new Date().toISOString(),
        };
        set({ currentUser: user });
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
