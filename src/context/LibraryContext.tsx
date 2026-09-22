"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { ClayColor } from "@/lib/types";
import { seedLibrary } from "@/lib/seedLibrary";

const STORAGE_KEY = "clay-mixer:library";

interface LibraryContextValue {
  colors: ClayColor[];
  loaded: boolean;
  addColor: (color: Omit<ClayColor, "id" | "createdAt">) => void;
  updateColor: (id: string, updates: Partial<Omit<ClayColor, "id">>) => void;
  removeColor: (id: string) => void;
  resetToSeed: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function readStorage(): ClayColor[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<ClayColor[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage isn't available during SSR, so the real library can only be
    // read client-side after mount; a render-time read would mismatch hydration.
    const stored = readStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColors(stored ?? seedLibrary());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  }, [colors, loaded]);

  const addColor: LibraryContextValue["addColor"] = (color) => {
    setColors((prev) => [
      ...prev,
      { ...color, id: crypto.randomUUID(), createdAt: Date.now() },
    ]);
  };

  const updateColor: LibraryContextValue["updateColor"] = (id, updates) => {
    setColors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const removeColor: LibraryContextValue["removeColor"] = (id) => {
    setColors((prev) => prev.filter((c) => c.id !== id));
  };

  const resetToSeed = () => setColors(seedLibrary());

  return (
    <LibraryContext.Provider
      value={{ colors, loaded, addColor, updateColor, removeColor, resetToSeed }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
