"use client";

import {
  Check,
  ChevronDown,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type Option = {
  label: string;
  value: string;
};

export function OrderSelect({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: Option[];
}) {
  const [value, setValue] =
    useState(defaultValue);

  const [open, setOpen] =
    useState(false);

  const ref =
    useRef<HTMLDivElement | null>(
      null
    );

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    function handleOutside(
      event: MouseEvent
    ) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape"
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  const selected =
    options.find(
      (option) =>
        option.value === value
    ) ?? options[0];

  return (
    <div
      ref={ref}
      className="relative"
    >
      <input
        type="hidden"
        name={name}
        value={value}
      />

      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        className={`flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3.5 text-left text-sm font-medium transition ${
          open
            ? "border-[#17352c] bg-white shadow-[0_5px_16px_rgba(23,53,44,0.06)]"
            : "border-neutral-300 bg-white hover:border-neutral-400"
        }`}
      >
        <span>
          {selected.label}
        </span>

        <ChevronDown
          size={15}
          className={`shrink-0 text-neutral-500 transition-transform ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[100] w-full overflow-hidden rounded-xl border border-white/70 bg-white/55 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.13)] backdrop-blur-[24px]">
          <div className="space-y-1">
            {options.map(
              (option) => {
                const active =
                  option.value ===
                  value;

                return (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    onClick={() => {
                      setValue(
                        option.value
                      );

                      setOpen(
                        false
                      );
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-white/85 font-semibold text-neutral-950 shadow-sm"
                        : "bg-white/10 text-neutral-700 hover:bg-white/55 hover:text-neutral-950"
                    }`}
                  >
                    <span>
                      {
                        option.label
                      }
                    </span>

                    {active && (
                      <Check
                        size={14}
                        className="text-[#17352c]"
                      />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}