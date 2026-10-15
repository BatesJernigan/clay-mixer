"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ClayColor, clayKey } from "@/lib/types";
import { catalogUrl, seedLibrary } from "@/lib/seedLibrary";

const STORAGE_KEY = "clay-mixer:library";
const OUT_OF_STOCK_KEY = "clay-mixer:out-of-stock";

interface LibraryContextValue {
  colors: ClayColor[];
  /** `colors` minus the ones marked out of stock — what recipes mix from. */
  inStockColors: ClayColor[];
  outOfStock: ReadonlySet<string>;
  toggleOutOfStock: (clay: ClayColor) => void;
  clearOutOfStock: () => void;
  loaded: boolean;
  addColor: (color: Omit<ClayColor, "id" | "createdAt">) => void;
  resetToSeed: () => void;
  importColors: (colors: Omit<ClayColor, "id" | "createdAt">[]) => number;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function readStorage(key: string): unknown[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
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
  const [outOfStock, setOutOfStock] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // localStorage isn't available during SSR, so the real library can only be
    // read client-side after mount; a render-time read would mismatch hydration.
    const stored = readStorage(STORAGE_KEY) as ClayColor[] | null;
    // Libraries saved before product links existed get them filled in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColors(
      stored?.map((c) => (c.url ? c : { ...c, url: catalogUrl(c) })) ??
        seedLibrary()
    );
    setOutOfStock(new Set((readStorage(OUT_OF_STOCK_KEY) as string[]) ?? []));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  }, [colors, loaded]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(OUT_OF_STOCK_KEY, JSON.stringify([...outOfStock]));
  }, [outOfStock, loaded]);

  const inStockColors = useMemo(
    () => colors.filter((c) => !outOfStock.has(clayKey(c))),
    [colors, outOfStock]
  );

  const toggleOutOfStock = (clay: ClayColor) => {
    setOutOfStock((prev) => {
      const next = new Set(prev);
      const key = clayKey(clay);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  const clearOutOfStock = () => setOutOfStock(new Set());

  const addColor: LibraryContextValue["addColor"] = (color) => {
    setColors((prev) => [
      ...prev,
      { ...color, id: crypto.randomUUID(), createdAt: Date.now() },
    ]);
  };

  const resetToSeed = () => setColors(seedLibrary());

  const importColors: LibraryContextValue["importColors"] = (newColors) => {
    const existingKeys = new Set(colors.map(clayKey));
    const toAdd = newColors.filter((c) => !existingKeys.has(clayKey(c)));
    if (toAdd.length > 0) {
      const now = Date.now();
      setColors((prev) => [
        ...prev,
        ...toAdd.map((c) => ({ ...c, id: crypto.randomUUID(), createdAt: now })),
      ]);
    }
    return toAdd.length;
  };

  return (
    <LibraryContext.Provider
      value={{
        colors,
        inStockColors,
        outOfStock,
        toggleOutOfStock,
        clearOutOfStock,
        loaded,
        addColor,
        resetToSeed,
        importColors,
      }}
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
