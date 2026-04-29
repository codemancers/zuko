'use client';

import * as React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { cn } from '../../lib/utils';

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
  /** When set, clicking a row adds that item immediately (no checkboxes, no Add button). */
  onItemClick?: (item: EntityItem) => void;
  /** When using onItemClick, IDs that are already in context (show checkmark, click is no-op). */
  alreadyInContextIds?: string[];
  isLoading?: boolean;
  multiSelect?: boolean;
  className?: string;
}

export const EntitySelectorDialog = ({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found.',
  items,
  selectedIds,
  onSelectionChange,
  onConfirm,
  onItemClick,
  alreadyInContextIds = [],
  isLoading = false,
  multiSelect = true,
  className,
}: EntitySelectorDialogProps) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const clickToAddMode = Boolean(onItemClick);

  const filteredItems = React.useMemo(() => {
    const base = !searchQuery
      ? items
      : items.filter((item) => {
          const query = searchQuery.toLowerCase();
          return (
            item.label.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query)
          );
        });
    // Hide items that are already selected; they only show in the chip row
    return base.filter((item) => !selectedIds.includes(item.id));
  }, [items, searchQuery, selectedIds]);

  const selectedItems = React.useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

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
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    onConfirm(selectedItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[500px]', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute top-2.5 left-3 size-4 text-zinc-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white py-2 pr-3 pl-9 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          {/* Selected as chips (like tag input) */}
          {multiSelect && selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleItem(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                  <span className="truncate max-w-40">{item.label}</span>
                  <span
                    aria-hidden
                    className="text-zinc-500 dark:text-zinc-300"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}

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
                  const alreadyInContext =
                    clickToAddMode && alreadyInContextIds.includes(item.id);
                  const handleClick = () => {
                    if (clickToAddMode) {
                      if (!alreadyInContext) onItemClick?.(item);
                    } else {
                      handleToggleItem(item.id);
                    }
                  };
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={handleClick}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                        clickToAddMode && alreadyInContext && 'opacity-60',
                      )}
                    >
                      {/* Icon */}
                      {item.icon && <div className="shrink-0">{item.icon}</div>}

                      {/* Content: label and description on same line (matches @mention list) */}
                      <div className="min-w-0 flex-1 flex items-baseline gap-2 text-sm truncate">
                        <span className="truncate font-medium text-zinc-900 dark:text-white">
                          {item.label}
                        </span>
                        {item.description && (
                          <>
                            <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
                              ·
                            </span>
                            <span className="truncate text-zinc-600 dark:text-zinc-400">
                              {item.description}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            {clickToAddMode ? 'Close' : 'Cancel'}
          </Button>
          {!clickToAddMode && (
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              type="button"
            >
              Add {selectedIds.length > 0 && `(${selectedIds.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
