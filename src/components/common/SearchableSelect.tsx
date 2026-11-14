import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type SearchableSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  clearLabel?: string;
  emptyMessage?: string;
  onChange: (value: string) => void;
};

export default function SearchableSelect({
  value,
  options,
  placeholder = "Pilih data...",
  disabled = false,
  clearLabel = "-- PILIH --",
  emptyMessage = "Data tidak ditemukan.",
  onChange,
}: SearchableSelectProps) {
  const uniqueId = useId().replace(/:/g, "");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeOptionRef = useRef<HTMLButtonElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] =
    useState<CSSProperties>({});

  const focusNextElement = () => {
    if (!triggerRef.current) {
      return;
    }

    const focusableElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(",")
      )
    ).filter((element) => {
      const style = window.getComputedStyle(element);

      return (
        element.offsetParent !== null &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    });

    const currentIndex = focusableElements.indexOf(
      triggerRef.current
    );

    if (currentIndex < 0) {
      return;
    }

    const nextElement =
      focusableElements[currentIndex + 1];

    if (nextElement) {
      nextElement.focus();
    }
  };

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return options;
    }

    return options.filter((option) =>
      [option.label, option.searchText ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [options, search]);

  const updateDropdownPosition = () => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 320);
    const viewportHeight = window.innerHeight;
    const estimatedHeight = 300;
    const spaceBelow = viewportHeight - rect.bottom;

    const shouldOpenAbove =
      spaceBelow < estimatedHeight &&
      rect.top > spaceBelow;

    if (shouldOpenAbove) {
      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        bottom: viewportHeight - rect.top + 4,
        width: dropdownWidth,
        zIndex: 9999,
      });
      return;
    }

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      top: rect.bottom + 4,
      width: dropdownWidth,
      zIndex: 9999,
    });
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setSearch("");
    setActiveIndex(-1);
  };

  const openDropdown = (initialIndex = -1) => {
    if (disabled) {
      return;
    }

    updateDropdownPosition();
    setIsOpen(true);
    setActiveIndex(initialIndex);

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const selectOption = (
    option: SearchableSelectOption,
    moveToNext = false
  ) => {
    onChange(option.value);

    closeDropdown();

    requestAnimationFrame(() => {
      if (moveToNext) {
        focusNextElement();
        return;
      }

      triggerRef.current?.focus();
    });
  };

  useEffect(() => {
    if (activeIndex >= filteredOptions.length) {
      setActiveIndex(
        filteredOptions.length > 0 ? 0 : -1
      );
    }
  }, [activeIndex, filteredOptions]);

  useEffect(() => {
    if (activeIndex >= 0) {
      activeOptionRef.current?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [activeIndex]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (
      event: MouseEvent
    ) => {
      const target = event.target as Node;

      if (
        containerRef.current &&
        dropdownRef.current &&
        !containerRef.current.contains(target) &&
        !dropdownRef.current.contains(target)
      ) {
        closeDropdown();
      }
    };

    const handleWindowChange = () => {
      updateDropdownPosition();
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );
    window.addEventListener(
      "resize",
      handleWindowChange
    );
    window.addEventListener(
      "scroll",
      handleWindowChange,
      true
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
      window.removeEventListener(
        "resize",
        handleWindowChange
      );
      window.removeEventListener(
        "scroll",
        handleWindowChange,
        true
      );
    };
  }, [isOpen]);

  const handleKeyboardNavigation = (
    event: KeyboardEvent<
      HTMLInputElement | HTMLButtonElement
    >
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        openDropdown(0);
        return;
      }

      if (filteredOptions.length === 0) {
        return;
      }

      setActiveIndex((previous) =>
        previous < filteredOptions.length - 1
          ? previous + 1
          : 0
      );

      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        openDropdown(
          Math.max(filteredOptions.length - 1, 0)
        );
        return;
      }

      if (filteredOptions.length === 0) {
        return;
      }

      setActiveIndex((previous) =>
        previous <= 0
          ? filteredOptions.length - 1
          : previous - 1
      );

      return;
    }

    if (event.key === "Enter") {
      if (
        isOpen &&
        activeIndex >= 0 &&
        filteredOptions[activeIndex]
      ) {
        event.preventDefault();
        event.stopPropagation();

        selectOption(
          filteredOptions[activeIndex],
          true
        );
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  };

  const dropdown = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          id={`searchable-select-dropdown-${uniqueId}`}
          style={dropdownStyle}
          className="overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg"
        >
          <div className="border-b border-gray-200 bg-white p-2">
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyboardNavigation}
              placeholder="Cari..."
              className="w-full rounded border border-blue-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="max-h-[220px] overflow-y-auto overscroll-contain">
            <button
              type="button"
              onMouseDown={(event) =>
                event.preventDefault()
              }
              onClick={() => {
                onChange("");
                closeDropdown();
              }}
              className="block min-h-[44px] w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100"
            >
              {clearLabel}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map(
                (option, index) => {
                  const isSelected =
                    option.value === value;
                  const isActive =
                    index === activeIndex;

                  return (
                    <button
                      key={option.value}
                      ref={
                        isActive
                          ? activeOptionRef
                          : null
                      }
                      type="button"
                      onMouseEnter={() =>
                        setActiveIndex(index)
                      }
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        selectOption(option)
                      }
                      className={`block min-h-[44px] w-full px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-gray-200 text-gray-900"
                          : isSelected
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div
        ref={containerRef}
        className="relative w-full"
      >
       <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() =>
            isOpen
              ? closeDropdown()
              : openDropdown()
          }
          onKeyDown={handleKeyboardNavigation}
          className="flex min-h-[44px] w-full items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
        >
          <span
            className={
              selectedOption
                ? "text-gray-800"
                : "text-gray-500"
            }
          >
            {selectedOption?.label ?? placeholder}
          </span>

          <span className="ml-3 shrink-0 text-xs text-gray-500">
            {isOpen ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {dropdown}
    </>
  );
}
