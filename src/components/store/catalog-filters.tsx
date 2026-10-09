"use client";

import {
  Check,
  ChevronDown,
  Search,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Option = {
  label: string;
  value: string;
};

const sortOptions: Option[] = [
  {
    label: "Newest",
    value: "newest",
  },
  {
    label: "Name A–Z",
    value: "name",
  },
  {
    label: "Price: Low to High",
    value: "price-asc",
  },
  {
    label: "Price: High to Low",
    value: "price-desc",
  },
];

export function CatalogFilters({
  categories,
  query,
  categorySlug,
  sort,
}: {
  categories: Category[];
  query: string;
  categorySlug?: string;
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [
    searchValue,
    setSearchValue,
  ] = useState(query);

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState(
    categorySlug ?? ""
  );

  const [
    selectedSort,
    setSelectedSort,
  ] = useState(sort);

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  useEffect(() => {
    setSelectedCategory(
      categorySlug ?? ""
    );
  }, [categorySlug]);

  useEffect(() => {
    setSelectedSort(sort);
  }, [sort]);

  function applyFilters() {
    const params =
      new URLSearchParams();

    const cleanSearch =
      searchValue.trim();

    if (cleanSearch) {
      params.set(
        "q",
        cleanSearch
      );
    }

    if (selectedCategory) {
      params.set(
        "category",
        selectedCategory
      );
    }

    if (
      selectedSort &&
      selectedSort !== "newest"
    ) {
      params.set(
        "sort",
        selectedSort
      );
    }

    const queryString =
      params.toString();

    router.push(
      queryString
        ? `${pathname}?${queryString}`
        : pathname
    );
  }

  const categoryOptions: Option[] = [
    {
      label: "All categories",
      value: "",
    },
    ...categories.map(
      (category) => ({
        label: category.name,
        value: category.slug,
      })
    ),
  ];

  return (
    <div className="relative z-30 mt-7 rounded-2xl border border-white/70 bg-white/40 p-3 shadow-[0_8px_24px_rgba(23,53,44,0.04)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* SEARCH */}
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-white/75 bg-white/50 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-xl">
          <Search
            size={16}
            className="shrink-0 text-neutral-400"
          />

          <input
            type="search"
            value={searchValue}
            onChange={(event) =>
              setSearchValue(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();
                applyFilters();
              }
            }}
            placeholder="Search products, SKU or brand"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
          />
        </div>

        {/* CATEGORY */}
        <GlassDropdown
          value={
            selectedCategory
          }
          options={
            categoryOptions
          }
          onChange={
            setSelectedCategory
          }
          className="lg:w-[210px]"
        />

        {/* SORT */}
        <GlassDropdown
          value={
            selectedSort
          }
          options={
            sortOptions
          }
          onChange={
            setSelectedSort
          }
          className="lg:w-[210px]"
        />

        {/* APPLY */}
        <button
          type="button"
          onClick={applyFilters}
          className="h-11 shrink-0 rounded-xl bg-[#17352c] px-6 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(23,53,44,0.12)] transition hover:bg-[#24483d]"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

export function CategorySort({
  sort,
}: {
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [
    selectedSort,
    setSelectedSort,
  ] = useState(sort);

  useEffect(() => {
    setSelectedSort(sort);
  }, [sort]);

  function changeSort(
    value: string
  ) {
    setSelectedSort(value);

    const params =
      new URLSearchParams();

    if (
      value !== "newest"
    ) {
      params.set(
        "sort",
        value
      );
    }

    const query =
      params.toString();

    router.push(
      query
        ? `${pathname}?${query}`
        : pathname
    );
  }

  return (
    <GlassDropdown
      value={selectedSort}
      options={sortOptions}
      onChange={changeSort}
      className="w-full sm:w-[210px]"
    />
  );
}

function GlassDropdown({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: Option[];
  onChange: (
    value: string
  ) => void;
  className?: string;
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  useEffect(() => {
    function handleOutside(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
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
        event.key ===
        "Escape"
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
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* TRIGGER */}
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        aria-expanded={open}
        className={`flex h-11 w-full items-center justify-between gap-4 rounded-xl border px-4 text-left text-sm font-medium text-neutral-800 backdrop-blur-xl transition ${
          open
            ? "border-white/80 bg-white/68 shadow-[0_6px_18px_rgba(0,0,0,0.05)]"
            : "border-white/75 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_5px_14px_rgba(23,53,44,0.03)] hover:bg-white/62"
        }`}
      >
        <span className="truncate">
          {selected.label}
        </span>

        <ChevronDown
          size={15}
          className={`shrink-0 text-neutral-500 transition-transform duration-200 ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {/* MENU */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[150] w-full overflow-hidden rounded-[20px] border border-white/65 bg-white/28 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.12)] backdrop-blur-[24px]">
          <div
            className="max-h-[290px] space-y-1 overflow-y-auto overscroll-contain pr-0.5"
            style={{
              scrollbarWidth:
                "none",
              msOverflowStyle:
                "none",
            }}
          >
            {options.map(
              (option) => {
                const active =
                  option.value ===
                  value;

                return (
                  <button
                    key={
                      option.value ||
                      "all"
                    }
                    type="button"
                    onClick={() => {
                      onChange(
                        option.value
                      );
                      setOpen(
                        false
                      );
                    }}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                      active
                        ? "border-white/70 bg-white/72 font-semibold text-neutral-950 shadow-[0_4px_10px_rgba(0,0,0,0.04)]"
                        : "border-transparent bg-white/12 text-neutral-700 hover:border-white/45 hover:bg-white/34 hover:text-neutral-950"
                    }`}
                  >
                    <span className="truncate">
                      {
                        option.label
                      }
                    </span>

                    {active && (
                      <Check
                        size={14}
                        className="shrink-0 text-[#17352c]"
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
