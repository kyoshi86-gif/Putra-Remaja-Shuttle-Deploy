import { useMemo, useState } from "react";
import type { CoaNode } from "../types";

interface AccountTreeProps {
  accounts: CoaNode[];
  selectedId?: string | null;
  onSelect?: (account: CoaNode) => void;
  showInactive?: boolean;
  disabledAccountId?: string | null;
}

export function AccountTree({
  accounts,
  selectedId,
  onSelect,
  showInactive = false,
  disabledAccountId = null,
}: AccountTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, CoaNode[]>();

    accounts
      .filter((account) => showInactive || account.is_active)
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach((account) => {
        const parentId = account.parent_account_id;
        const children = map.get(parentId) ?? [];

        children.push(account);
        map.set(parentId, children);
      });

    return map;
  }, [accounts, showInactive]);

  const toggleExpanded = (accountId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }

      return next;
    });
  };

  const renderNode = (account: CoaNode) => {
    const children = childrenByParent.get(account.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const isSelected = selectedId === account.id;
    const isDisabled = disabledAccountId === account.id;

    return (
      <div key={account.id}>
        <div
          className={[
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
            isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50",
            isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ].join(" ")}
          style={{ paddingLeft: `${account.account_level * 16}px` }}
        >
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center text-gray-500"
            onClick={(event) => {
              event.stopPropagation();

              if (hasChildren) {
                toggleExpanded(account.id);
              }
            }}
            disabled={!hasChildren}
          >
            {hasChildren ? (isExpanded ? "▾" : "▸") : ""}
          </button>

          <button
            type="button"
            className="flex flex-1 items-center justify-between gap-3 text-left"
            onClick={() => {
              if (!isDisabled) {
                onSelect?.(account);
              }
            }}
            disabled={isDisabled}
          >
            <span className="min-w-0 truncate">
              <span className="font-medium">{account.code}</span>
              <span className="ml-2">{account.name}</span>
            </span>

            <span className="shrink-0 text-xs text-gray-500">
              {account.is_posting ? "Posting" : "Summary"}
            </span>
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div>{children.map((child) => renderNode(child))}</div>
        )}
      </div>
    );
  };

  const rootAccounts = childrenByParent.get(null) ?? [];

  if (rootAccounts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500">
        Belum ada akun.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rootAccounts.map((account) => renderNode(account))}
    </div>
  );
}
