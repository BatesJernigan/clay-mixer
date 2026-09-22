interface ColorSwatchProps {
  hex: string;
  size?: number;
  label?: string;
  className?: string;
}

export function ColorSwatch({ hex, size = 40, label, className }: ColorSwatchProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div
        className="rounded-md border border-black/10 shadow-sm shrink-0"
        style={{ width: size, height: size, backgroundColor: hex }}
      />
      {label && <span className="text-sm text-neutral-600">{label}</span>}
    </div>
  );
}
