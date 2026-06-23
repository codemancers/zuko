'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useDebounce } from '@uidotdev/usehooks';
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Dialog,
  Input,
  InputGroup,
  Spinner,
  cn,
} from '@zuko/ui-kit';
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import { toast } from 'sonner';
import { getOrgSearch, getProspectSearch } from '@/server/query-options';
import { apolloProspectsApi, type ProspectPerson } from '@/lib/api/apollo';

// ─── Types ─────────────────────────────────────────────────────────────────

interface OrgOption {
  id: string;
  name: string;
  domain?: string;
}

interface ProspectFilters {
  name: string;
  jobTitles: string[];
  locations: string[];
  companies: OrgOption[];
}

const EMPTY_FILTERS: ProspectFilters = {
  name: '',
  jobTitles: [],
  locations: [],
  companies: [],
};

function hasActiveFilters(filters: ProspectFilters): boolean {
  return (
    filters.name.trim().length >= 3 ||
    filters.jobTitles.length > 0 ||
    filters.locations.length > 0 ||
    filters.companies.length > 0
  );
}

// ─── Tag input (job titles / locations) ──────────────────────────────────────

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  ariaLabel: string;
}

function TagInput({ values, onChange, placeholder, ariaLabel }: TagInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft('');
  }, [draft, onChange, values]);

  const removeTag = (tag: string) =>
    onChange(values.filter((value) => value !== tag));

  return (
    <div className="space-y-2">
      <Input
        type="text"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge key={value} color="zinc" className="gap-1">
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => removeTag(value)}
                className="-mr-0.5 rounded-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Company autocomplete (async search + multi-select) ───────────────────────

interface CompanyComboboxProps {
  selected: OrgOption[];
  onAdd: (org: OrgOption) => void;
  onRemove: (id: string) => void;
}

function CompanyCombobox({ selected, onAdd, onRemove }: CompanyComboboxProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350);

  const { data: results = [], isFetching } = useQuery(
    getOrgSearch(debouncedQuery),
  );

  const suggestions = results.filter(
    (result) => !selected.some((org) => org.id === result.id),
  );
  const showDropdown = query.trim().length >= 2 && suggestions.length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <InputGroup>
          <MagnifyingGlassIcon data-slot="icon" />
          <Input
            type="search"
            aria-label="Search companies"
            placeholder="Search company…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        {isFetching && (
          <Spinner className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
        )}

        {showDropdown && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-950/10 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-zinc-800">
            {suggestions.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5"
                  onClick={() => {
                    onAdd(org);
                    setQuery('');
                  }}
                >
                  {org.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((org) => (
            <Badge key={org.id} color="blue" className="gap-1">
              {org.name}
              <button
                type="button"
                aria-label={`Remove ${org.name}`}
                onClick={() => onRemove(org.id)}
                className="-mr-0.5 rounded-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <XMarkIcon className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible filter section ───────────────────────────────────────────────

interface FilterSectionProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function FilterSection({
  icon: Icon,
  label,
  active,
  defaultOpen = false,
  children,
}: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-950/10 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
      >
        <span className="flex items-center gap-2.5">
          <Icon className="size-4 text-zinc-400" />
          <span
            className={
              active ? 'font-medium text-zinc-950 dark:text-white' : ''
            }
          >
            {label}
          </span>
          {active && <span className="size-1.5 rounded-full bg-blue-500" />}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-4 text-zinc-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="px-4 pt-1 pb-3">{children}</div>}
    </div>
  );
}

// ─── Prospect result row ──────────────────────────────────────────────────────

interface ProspectRowProps {
  person: ProspectPerson;
  selected: boolean;
  onToggle: () => void;
}

function ProspectRow({ person, selected, onToggle }: ProspectRowProps) {
  const location = [person.city, person.state, person.country]
    .filter(Boolean)
    .join(', ');

  return (
    <label className="flex cursor-pointer items-start gap-3 border-b border-zinc-950/5 px-4 py-3 last:border-0 hover:bg-zinc-100 dark:border-white/5 dark:hover:bg-white/5">
      <Checkbox
        color="blue"
        checked={selected}
        onChange={onToggle}
        className="mt-0.5 shrink-0"
        aria-label={`Select ${person.name}`}
      />
      <Avatar
        src={person.photoUrl}
        initials={person.name?.[0]?.toUpperCase() ?? '?'}
        alt={person.name}
        className="size-9 shrink-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-950 dark:text-white">
            {person.name}
          </span>
          {person.isContact ? (
            <Badge color="green">In CRM</Badge>
          ) : (
            <Badge color="zinc">Prospect</Badge>
          )}
        </div>
        {person.title && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {person.title}
          </p>
        )}
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400 dark:text-zinc-500">
          {person.organizationName && <span>{person.organizationName}</span>}
          {location && <span>{location}</span>}
        </div>
      </div>
    </label>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface AddContactsDialogProps {
  sequenceId: string;
  open: boolean;
  onClose: () => void;
}

export default function AddContactsDialog({
  sequenceId,
  open,
  onClose,
}: AddContactsDialogProps) {
  const [filters, setFilters] = useState<ProspectFilters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debouncedFilters = useDebounce(filters, 800);
  const filtersActive = hasActiveFilters(debouncedFilters);

  const searchParams = useMemo(
    () => ({
      personName: debouncedFilters.name.trim() || undefined,
      personTitles: debouncedFilters.jobTitles.length
        ? debouncedFilters.jobTitles
        : undefined,
      personLocations: debouncedFilters.locations.length
        ? debouncedFilters.locations
        : undefined,
      organizationIds: debouncedFilters.companies.length
        ? debouncedFilters.companies.map((org) => org.id)
        : undefined,
      organizationDomains: debouncedFilters.companies.length
        ? (debouncedFilters.companies
            .map((org) => org.domain)
            .filter(Boolean) as string[])
        : undefined,
    }),
    [debouncedFilters],
  );

  const { data, isFetching } = useQuery({
    ...getProspectSearch(searchParams),
    enabled: filtersActive,
  });

  const people = useMemo(() => data?.people ?? [], [data]);
  const totalEntries = data?.pagination.total_entries ?? people.length;

  // Reset selection whenever a new result set arrives.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [data]);

  const togglePerson = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = people.length > 0 && selectedIds.size === people.length;
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(people.map((p) => p.id)));

  const updateFilters = useCallback(
    (patch: Partial<ProspectFilters>) =>
      setFilters((prev) => ({ ...prev, ...patch })),
    [],
  );

  const handleClose = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);

  const addMutation = useMutation({
    mutationFn: () => {
      const selected = people.filter((person) => selectedIds.has(person.id));
      const contacts = selected.filter((person) => person.isContact);
      const prospects = selected.filter((person) => !person.isContact);
      return apolloProspectsApi.addToSequence({
        sequenceId,
        contactIds: contacts.map((person) => person.contactId!),
        personIds: prospects.map((person) => person.id),
        personData: prospects.map((person) => ({
          firstName: person.firstName,
          lastName: person.lastName,
          organizationName: person.organizationName,
        })),
      });
    },
    onSuccess: (result) => {
      const failed = result.failedPersonIds?.length ?? 0;
      const count = selectedIds.size;
      if (failed > 0) {
        toast.warning(
          `Added to sequence — ${failed} prospect${failed > 1 ? 's' : ''} could not be converted to contacts.`,
        );
      } else {
        toast.success(
          `${count} contact${count > 1 ? 's' : ''} added to the sequence.`,
        );
      }
      handleClose();
    },
    onError: () => toast.error('Failed to add contacts. Please try again.'),
  });

  return (
    <Dialog
      size="5xl"
      open={open}
      onClose={handleClose}
      className="flex h-[80vh] flex-col overflow-hidden p-0!"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-950/10 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Add contacts to sequence
        </h2>
        <Button plain aria-label="Close" onClick={handleClose}>
          <XMarkIcon className="size-5" />
        </Button>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Filters */}
        <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-zinc-950/10 dark:border-white/10">
          <p className="shrink-0 px-4 py-3 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
            People filters
          </p>
          <div className="flex-1 overflow-y-auto">
            <FilterSection
              icon={UserCircleIcon}
              label="Name"
              defaultOpen
              active={filters.name.trim() !== ''}
            >
              <Input
                type="text"
                aria-label="Name"
                placeholder="e.g. Rishav Raj"
                value={filters.name}
                onChange={(event) =>
                  updateFilters({ name: event.target.value })
                }
              />
            </FilterSection>

            <FilterSection
              icon={BriefcaseIcon}
              label="Job title"
              active={filters.jobTitles.length > 0}
            >
              <TagInput
                ariaLabel="Job title"
                placeholder="e.g. Software Engineer"
                values={filters.jobTitles}
                onChange={(jobTitles) => updateFilters({ jobTitles })}
              />
            </FilterSection>

            <FilterSection
              icon={MapPinIcon}
              label="Location"
              active={filters.locations.length > 0}
            >
              <TagInput
                ariaLabel="Location"
                placeholder="e.g. Bengaluru, India"
                values={filters.locations}
                onChange={(locations) => updateFilters({ locations })}
              />
            </FilterSection>

            <FilterSection
              icon={BuildingOfficeIcon}
              label="Company"
              active={filters.companies.length > 0}
            >
              <CompanyCombobox
                selected={filters.companies}
                onAdd={(org) =>
                  updateFilters({ companies: [...filters.companies, org] })
                }
                onRemove={(id) =>
                  updateFilters({
                    companies: filters.companies.filter((org) => org.id !== id),
                  })
                }
              />
            </FilterSection>
          </div>
        </aside>

        {/* Results */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!filtersActive ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="Start by selecting a filter"
              description="Search your saved Apollo contacts by name, title, location, or company."
            />
          ) : isFetching ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
              <Spinner /> Searching…
            </div>
          ) : people.length === 0 ? (
            <EmptyState
              icon={MagnifyingGlassIcon}
              title="No results found"
              description="Try adjusting or removing some filters."
            />
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-zinc-950/10 px-4 py-2.5 dark:border-white/10">
                <Checkbox
                  color="blue"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {totalEntries.toLocaleString()}
                  </span>{' '}
                  people found
                  {selectedIds.size > 0 && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400">
                      · {selectedIds.size} selected
                    </span>
                  )}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {people.map((person) => (
                  <ProspectRow
                    key={person.id}
                    person={person}
                    selected={selectedIds.has(person.id)}
                    onToggle={() => togglePerson(person.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-between border-t border-zinc-950/10 px-5 py-3.5 dark:border-white/10">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {selectedIds.size > 0
            ? `${selectedIds.size} contact${selectedIds.size > 1 ? 's' : ''} selected`
            : 'Select people from the results to add them'}
        </p>
        <div className="flex items-center gap-2">
          <Button plain onClick={handleClose} disabled={addMutation.isPending}>
            Close
          </Button>
          <Button
            color="dark"
            disabled={selectedIds.size === 0 || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {addMutation.isPending && <Spinner />}
            {addMutation.isPending
              ? 'Adding…'
              : selectedIds.size > 0
                ? `Add to sequence (${selectedIds.size})`
                : 'Add to sequence'}
          </Button>
        </div>
      </footer>
    </Dialog>
  );
}

// ─── Empty / placeholder state ────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <Icon className="size-10 text-zinc-300 dark:text-zinc-600" />
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {title}
      </p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">{description}</p>
    </div>
  );
}
