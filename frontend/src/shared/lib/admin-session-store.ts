"use client";

import { create } from "zustand";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AdminSessionState {
  user: AdminUser | null;
  setUser: (user: AdminUser | null) => void;
}

export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
