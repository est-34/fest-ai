"use client";

import { create } from "zustand";
import type { ChatMessage } from "@/entities/visitor";

export const WELCOME_MESSAGE_ID = "perso-welcome";

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  addMessage: (message: ChatMessage) => void;
  setTyping: (typing: boolean) => void;
  reset: (welcome: ChatMessage) => void;
  syncWelcome: (welcome: ChatMessage) => void;
  /** 서버에 남아 있던 이전 대화로 화면을 채운다(새로고침 복원). */
  restoreMessages: (messages: ChatMessage[]) => void;
  /** id별로 content만 바꿔친다 — 언어 전환 시 고정 안내 문구(rawContent 보유)를 재번역해 반영한다. */
  updateMessageContents: (updates: Record<string, string>) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isTyping: false,
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setTyping: (isTyping) => set({ isTyping }),
  reset: (welcome) => set({ messages: [welcome], isTyping: false }),
  restoreMessages: (messages) => set({ messages, isTyping: false }),
  updateMessageContents: (updates) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        updates[message.id] !== undefined ? { ...message, content: updates[message.id] } : message,
      ),
    })),
  syncWelcome: (welcome) =>
    set((state) => ({
      messages:
        state.messages.length === 0 ||
        (state.messages.length === 1 && state.messages[0].id === WELCOME_MESSAGE_ID)
          ? [welcome]
          : state.messages,
    })),
}));
