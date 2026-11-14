import React, {
  useRef,
} from "react";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  disabled = false,
  min,
  max,
  className = "",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (disabled) {
      return;
    }

    const input = inputRef.current;

    if (!input) {
      return;
    }

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      }
    } catch {
      input.focus();
    }
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(event.target.value);
  };

  return (
    <div
      className={`relative w-full ${className}`}
      onClick={openPicker}
    >
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={handleChange}
        onClick={(event) => {
          event.stopPropagation();
          openPicker();
        }}
        className="
          w-full
          cursor-pointer
          rounded
          border
          px-3
          py-2
          disabled:cursor-not-allowed
          disabled:bg-slate-50
        "
      />
    </div>
  );
};

export default DateInput;