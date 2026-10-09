"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Option = { label: string; value: string };

export function BatchSelect({
  id,
  labelledBy,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  labelledBy: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [menu, setMenu] = useState({ value, open: false, activeIndex: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<number, HTMLDivElement>());
  const searchRef = useRef({ text: "", time: 0 });
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex] ?? options[0];
  const open = menu.open && !disabled && menu.value === value && options.length > 0;
  const activeIndex = Math.min(menu.activeIndex, options.length - 1);
  const listId = `${id}-listbox`;

  // An external selection or a loading state dismisses the menu immediately.
  // Keep this local UI state synchronized without effect-driven renders.
  if (menu.value !== value || (disabled && menu.open)) {
    setMenu({ value, open: false, activeIndex: Math.max(0, selectedIndex) });
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenu((current) => ({ ...current, open: false }));
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = optionRefs.current.get(activeIndex);
    if (!list || !option) return;
    // Scroll only the menu, keeping the page in place during keyboard navigation.
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [open, activeIndex]);

  function closeMenu() {
    setMenu((current) => ({ ...current, open: false }));
    searchRef.current = { text: "", time: 0 };
  }

  function choose(index: number) {
    if (disabled || !options[index]) return;
    closeMenu();
    triggerRef.current?.focus();
    // Native selects do not emit a change when the current option is chosen.
    // Preserve that behavior so the batch library does not reload unnecessarily.
    if (options[index].value !== value) onChange(options[index].value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || !options.length) return;
    const initialIndex = Math.max(0, selectedIndex);
    let nextIndex: number | undefined;
    switch (event.key) {
      case "ArrowDown": nextIndex = open ? (activeIndex + 1) % options.length : initialIndex; break;
      case "ArrowUp": nextIndex = open ? (activeIndex - 1 + options.length) % options.length : initialIndex; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = options.length - 1; break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(activeIndex);
        else setMenu({ value, open: true, activeIndex: initialIndex });
        return;
      case "Escape":
        if (open) { event.preventDefault(); event.stopPropagation(); closeMenu(); }
        return;
      case "Tab": closeMenu(); return;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const time = Date.now();
        const character = event.key.toLowerCase();
        const previous = searchRef.current;
        const text = time - previous.time < 700 && previous.text !== character ? previous.text + character : character;
        searchRef.current = { text, time };
        const start = open ? activeIndex : initialIndex;
        // Keep the current match for multi-letter searches; cycle repeated letters.
        for (let offset = text.length > 1 ? 0 : 1; offset <= options.length; offset++) {
          const index = (start + offset) % options.length;
          if (options[index].label.toLowerCase().startsWith(text)) { nextIndex = index; break; }
        }
      }
    }
    if (nextIndex !== undefined) {
      event.preventDefault();
      setMenu({ value, open: true, activeIndex: nextIndex });
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-labelledby={`${labelledBy} ${id}-value`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled || !options.length}
        onClick={() => {
          searchRef.current = { text: "", time: 0 };
          setMenu({ value, open: !open, activeIndex: Math.max(0, selectedIndex) });
        }}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!containerRef.current?.contains(event.relatedTarget as Node | null)) closeMenu();
        }}
        className={`flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3.5 text-left text-sm font-medium text-neutral-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17352c] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${
          open
            ? "border-[#17352c] bg-white shadow-[0_5px_16px_rgba(23,53,44,0.06)]"
            : "border-neutral-300 bg-white enabled:hover:border-neutral-400 enabled:active:bg-neutral-50"
        }`}
      >
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate" title={selected?.label}>{selected?.label}</span>
        <ChevronDown size={15} aria-hidden="true" className={`shrink-0 text-neutral-500 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[100] w-full overflow-hidden rounded-xl border border-white/70 bg-white/55 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.13)] backdrop-blur-[24px] supports-[not(backdrop-filter:blur(1px))]:bg-white [@media(prefers-reduced-transparency:reduce)]:bg-white [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none contrast-more:border-neutral-400 contrast-more:bg-white">
          <div ref={listRef} id={listId} role="listbox" aria-labelledby={labelledBy} className="relative max-h-[290px] space-y-1 overflow-y-auto overscroll-contain">
            {options.map((option, index) => {
              const selected = option.value === value;
              return (
                <div
                  ref={(element) => {
                    if (element) optionRefs.current.set(index, element);
                    else optionRefs.current.delete(index);
                  }}
                  id={`${id}-option-${index}`}
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition motion-reduce:transition-none ${
                    selected ? "bg-white/85 font-semibold text-neutral-950 shadow-sm"
                      : index === activeIndex ? "bg-white/55 text-neutral-950"
                        : "bg-white/10 text-neutral-700 hover:bg-white/55 hover:text-neutral-950"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
                  {selected && <Check size={14} aria-hidden="true" className="shrink-0 text-[#17352c]" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
