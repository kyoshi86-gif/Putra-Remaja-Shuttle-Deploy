import { useEffect, useMemo, useState } from "react";
import type { CoaNode } from "../types";
import { AccountTree } from "./AccountTree";

interface AccountSelectorProps {
  accounts: CoaNode[];
  value: string | null;
  onChange: (accountId: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  showInactive?: boolean;
  disabledAccountId?: string | null;
}

export function AccountSelector({
  accounts,
  value,
  onChange,
  label = "Parent Account",
  placeholder = "Pilih parent account",
  disabled = false,
  showInactive = false,
  disabledAccountId = null,
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedAccount = useMemo(() => {
    return accounts.find((account) => account.id === value) ?? null;
  }, [accounts, value]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className={selectedAccount ? "text-gray-900" : "text-gray-400"}>
          {selectedAccount
            ? `${selectedAccount.code} - ${selectedAccount.name}`
            : placeholder}
        </span>

        <span className="text-gray-500">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <button
            type="button"
            className="mb-2 w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-50"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Tanpa parent account
          </button>

          <AccountTree
            accounts={accounts}
            selectedId={value}
            showInactive={showInactive}
            disabledAccountId={disabledAccountId}
            onSelect={(account) => {
              onChange(account.id);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
