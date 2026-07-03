"use client";

interface QuickReplyChipsProps {
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export default function QuickReplyChips({ options, onSelect, disabled }: QuickReplyChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          className="px-3 py-1.5 rounded-full border border-[#0487D9] text-[#0487D9] text-sm font-medium bg-white hover:bg-[#0487D9] hover:text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
