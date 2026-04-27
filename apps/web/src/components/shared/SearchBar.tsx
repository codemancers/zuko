import { Input, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@zuko/ui-kit';
import { Bars3Icon } from '@heroicons/react/24/outline';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onAddColumn?: () => void;
}

export function SearchBar({ value, onChange, placeholder, onAddColumn }: SearchBarProps) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-md"
      />
      {onAddColumn && (
        <div className="ml-auto">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button outline onClick={onAddColumn} aria-label="Add Column">
                  <Bars3Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>
                <p>Add Column</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
