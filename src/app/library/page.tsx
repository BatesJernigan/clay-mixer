"use client";

import { useMemo, useState } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { ColorSwatch } from "@/components/ColorSwatch";
import { HexColorField } from "@/components/HexColorField";
import { ClayColor } from "@/lib/types";
import { isValidHex, normalizeHex } from "@/lib/color";

function AddColorForm() {
  const { addColor, colors } = useLibrary();
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#cccccc");

  const knownBrands = useMemo(
    () => Array.from(new Set(colors.map((c) => c.brand))).sort(),
    [colors]
  );

  const canSubmit = brand.trim() && name.trim() && isValidHex(hex);

  const submit = () => {
    if (!canSubmit) return;
    addColor({ brand: brand.trim(), name: name.trim(), hex: normalizeHex(hex) });
    setName("");
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-900">Add a clay color</h2>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Brand</label>
          <input
            list="brand-options"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Premo Sculpey"
            className="w-48 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
          <datalist id="brand-options">
            {knownBrands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Color name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cadmium Red"
            className="w-48 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
        </div>

        <HexColorField value={hex} onChange={setHex} label="Hex" />

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          Add color
        </button>
      </div>
    </div>
  );
}

function LibraryRow({ clay }: { clay: ClayColor }) {
  const { updateColor, removeColor } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(clay.name);
  const [hex, setHex] = useState(clay.hex);

  const save = () => {
    if (!name.trim() || !isValidHex(hex)) return;
    updateColor(clay.id, { name: name.trim(), hex: normalizeHex(hex) });
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-3 py-3">
        <HexColorField value={hex} onChange={setHex} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[10rem] rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <button
          onClick={save}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <ColorSwatch hex={clay.hex} size={36} />
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-900">{clay.name}</p>
        <p className="text-xs font-mono text-neutral-500">{clay.hex}</p>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        Edit
      </button>
      <button
        onClick={() => removeColor(clay.id)}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </li>
  );
}

export default function LibraryPage() {
  const { colors, loaded, resetToSeed } = useLibrary();

  const byBrand = useMemo(() => {
    const groups = new Map<string, ClayColor[]>();
    for (const clay of colors) {
      const list = groups.get(clay.brand) ?? [];
      list.push(clay);
      groups.set(clay.brand, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [colors]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Clay Library
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Manage the brand and color combinations available for mixing.
          </p>
        </div>
        {loaded && colors.length === 0 && (
          <button
            onClick={resetToSeed}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Load starter colors
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <AddColorForm />

        {byBrand.map(([brand, brandColors]) => (
          <div key={brand} className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-neutral-900">{brand}</h2>
            <ul className="divide-y divide-neutral-100">
              {brandColors
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((clay) => (
                  <LibraryRow key={clay.id} clay={clay} />
                ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
