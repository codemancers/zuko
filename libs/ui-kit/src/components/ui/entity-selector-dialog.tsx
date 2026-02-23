"use client";

import * as React from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export interface EntityItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  metadata?: Record<string, unknown>;
}

export interface EntitySelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  items: EntityItem[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onConfirm: (selectedItems: EntityItem[]) => void;
  isLoading?: boolean;
  multiSelect?: boolean;
  className?: string;
}

export const EntitySelectorDialog = ({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  items,
  selectedIds,
  onSelectionChange,
  onConfirm,
  isLoading = false,
  multiSelect = true,
  className,
}: EntitySelectorDialogProps) => {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredItems = React.useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  const handleToggleItem = (id: string) => {
    if (multiSelect) {
      const newSelection = selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id];
      onSelectionChange(newSelection);
    } else {
      onSelectionChange([id]);
    }
  };

  const handleConfirm = () => {
    const selectedItems = items.filter((item) =>
      selectedIds.includes(item.id)
    );
    onConfirm(selectedItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-[500px]", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <SearchIcon className="absolute top-2.5 left-3 size-4 text-zinc-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pr-3 pl-9 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          {/* Items List */}
          <div className="max-h-[300px] overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-zinc-600 dark:text-zinc-400">
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-zinc-600 dark:text-zinc-400">
                {emptyMessage}
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleItem(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                        isSelected &&
                          "bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30"
                      )}
                    >
                      {/* Icon */}
                      {item.icon && (
                        <div className="shrink-0">{item.icon}</div>
                      )}

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-sm text-zinc-900 dark:text-white">
                          {item.label}
                        </div>
                        {item.description && (
                          <div className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                            {item.description}
                          </div>
                        )}
                      </div>

                      {/* Checkbox/Checkmark */}
                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="flex size-5 items-center justify-center rounded bg-blue-600 text-white">
                            <CheckIcon className="size-3.5" />
                          </div>
                        ) : (
                          <div className="size-5 rounded border-2 border-zinc-300 dark:border-zinc-700" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {multiSelect && selectedIds.length > 0 && (
            <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              {selectedIds.length} selected
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            type="button"
          >
            Add {selectedIds.length > 0 && `(${selectedIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
