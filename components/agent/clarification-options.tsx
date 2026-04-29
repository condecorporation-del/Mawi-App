"use client";

type Props = {
  options: string[];
  onSelect: (option: string) => void;
};

export function ClarificationOptions({ options, onSelect }: Props) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {options.map((opt) => (
        <button
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
          key={opt}
          onClick={() => onSelect(opt)}
          type="button"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
