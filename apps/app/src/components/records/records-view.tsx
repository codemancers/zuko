'use client';

import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createColumnHelper,
  type ColumnDef,
  type ColumnFiltersState,
  type Table,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import {
  AlertCircle,
  LoaderCircle,
  Plus,
  RefreshCw,
  SearchX,
  Settings,
} from 'lucide-react';
import { AddFieldDrawer } from '@/components/records/add-field-drawer';
import { FieldSettingsDrawer } from '@/components/records/fields-drawer';
import {
  textFilter,
  valuesFilter,
  useCellStatus,
  useRowChanges,
  useRowDrawer,
  useSheet,
  useSheetCellEditing,
} from '@codemancers/sheets';
import {
  Sheet,
  SheetEditableTextCell,
  SheetPrimaryCell,
  SheetTextCell,
} from '@codemancers/sheets/ui';
import { FilterChips } from '@/components/records/filters';
import { RecordForm } from '@/components/records/record-form';
import { LinkCell } from '@/components/records/link-cell';
import { PickCell, type Option } from '@/components/records/pick-cell';
import { UsersCell } from '@/components/records/users-cell';
import { RecordTimeline } from '@/components/records/record-timeline';
import { RecordLinks } from '@/components/records/record-links';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import {
  columnsFor,
  emptyValues,
  encodeFilter,
  formatValue,
  linkIds,
  memberIds,
  parseFilters,
  propertiesFromValues,
  recordLabel,
  sameLinks,
  searchBody,
  valuesFromRecord,
  type ColumnFilter,
  type FieldDef,
  type FormValues,
  type Linked,
  type Links,
  type ObjectDef,
  type RecordRow,
  type RecordsPage,
  type Sort,
} from '@/lib/records';
import {
  headerFilterKind,
  headerValue,
  toHeaderFilters,
  mergeHeaderFilters,
  type FieldFacets,
  type FacetEntry,
} from '@/lib/header-filters';
import { SAMPLE_RECORDS, type Sample } from '@/lib/sample-data';

// The API serves at most 100 rows a request, so a list is fetched in as many requests as it
// takes. The sheet renders every row it is given (it does not virtualise), and a few thousand
// is what it handles comfortably, so a list longer than this says so and can be searched.
const FETCH_SIZE = 100;
const MAX_ROWS = 2000;
const NO_ROWS: RecordRow[] = [];
const NO_PEOPLE: { members: Option[]; teams: Option[] } = { members: [], teams: [] };
// The row being typed into when adding: it is not a record yet.
const NEW_ROW_ID = 'new';
const PIN_NEW_ROW = { top: [], bottom: [NEW_ROW_ID] };
const PIN_NOTHING = { top: [], bottom: [] };
const col = createColumnHelper<RecordRow>();

type Definition = { object: string; def?: ObjectDef; problem?: string };
type Loaded = { query: string; rows?: RecordRow[]; total?: number; problem?: string };

/** What a cell edits in place: every kind of field that is not read-only. */
const inPlace = (field: FieldDef) =>
  !field.read_only &&
  ['TEXT', 'EMAIL', 'NUMBER', 'ENUM', 'TIMESTAMP', 'BOOLEAN', 'USER'].includes(field.type);

/** The properties for an in-place edit: a blank clears the value, a number is sent as one. */
function propertiesFromChanges(fields: FieldDef[], changes: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(changes)) {
    const text = String(value ?? '').trim();
    const field = fields.find((f) => f.name === name);
    if (field?.type === 'BOOLEAN') {
      properties[name] = value === true || value === 'true';
      continue;
    }
    if (Array.isArray(value)) {
      properties[name] = value.length > 0 ? value : null; // several members; none clears the field
      continue;
    }
    properties[name] = text === '' ? null : field?.type === 'NUMBER' ? Number(text) : text;
  }
  return properties;
}

/** An in-place edit as the update request: field values under `properties`, owner and team beside them. */
function bodyFromChanges(fields: FieldDef[], changes: Record<string, unknown>) {
  const { record_owner: owner, record_team: team, ...values } = changes;
  return {
    ...(Object.keys(values).length > 0
      ? { properties: propertiesFromChanges(fields, values) }
      : {}),
    ...(owner !== undefined ? { owner_id: owner === '' ? null : owner } : {}),
    ...(team !== undefined ? { team_id: team === '' ? null : team } : {}),
  };
}

/** A choice field edited in place. */
const ChoiceCell = ({ field, value }: { field: FieldDef; value: string }) => (
  <PickCell
    label={field.label}
    value={value}
    options={(field.config.options ?? []).map((o) => ({ value: o, label: o }))}
  />
);

/**
 * A date field edited in place, with the browser's own date picker. Typing a date passes through
 * incomplete states that the browser reports as empty; those are not a request to clear the
 * value, so only a deliberately emptied input saves a clear. What is being typed is kept here
 * until the input loses focus, so it is not rewritten under the cursor.
 */
function DateCell({ field, value }: { field: FieldDef; value: string }) {
  const cell = useSheetCellEditing();
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? String(cell.stagedValue ?? cell.refusedValue ?? value);
  return (
    <div className="flex h-8 items-center px-2">
      <input
        type="date"
        aria-label={field.label}
        value={shown}
        onChange={(event) => {
          const next = event.target.value;
          setTyped(next);
          if (next === '' && event.target.validity.badInput) return; // half-typed, not cleared
          void cell.stage(next);
        }}
        onBlur={() => setTyped(null)}
        className="h-6 w-full rounded-md bg-transparent px-1 text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </div>
  );
}

/** A yes/no field edited in place. */
function CheckCell({ field, value }: { field: FieldDef; value: boolean }) {
  const cell = useSheetCellEditing();
  const shown = typeof cell.stagedValue === 'boolean' ? cell.stagedValue : value;
  return (
    <div className="flex h-8 items-center px-3">
      <input
        type="checkbox"
        aria-label={field.label}
        checked={shown}
        onChange={(event) => void cell.stage(event.target.checked)}
        className="size-4 cursor-pointer accent-primary"
      />
    </div>
  );
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong';

const widthOf = (field: FieldDef) =>
  ({
    TEXT: 200,
    EMAIL: 260,
    NUMBER: 130,
    BOOLEAN: 100,
    TIMESTAMP: 150,
    ENUM: 160,
    LINK: 240,
    USER: 200,
  })[field.type] ?? 180;

/** Read definitions provisioned by the organization's setup workflow. */
async function loadDefinition(
  object: string,
  signal?: AbortSignal,
): Promise<{ def?: ObjectDef; problem?: string }> {
  try {
    return { def: await api<ObjectDef>(`/api/v1/objects/${object}`, { signal }) };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { problem: messageOf(error) };
  }
}

/** Every record that matches, across as many requests as it takes (up to `maxRows`). */
async function fetchAll(
  def: ObjectDef,
  search: string,
  sort: Sort | null,
  filters: ColumnFilter[],
  maxRows: number,
  signal?: AbortSignal,
): Promise<{ rows: RecordRow[]; total: number }> {
  const base = `/api/v1/objects/${def.name}/records`;
  const rows: RecordRow[] = [];
  let total = 0;
  for (let page = 1; ; page += 1) {
    const result =
      search || filters.length > 0
        ? await api<RecordsPage>(`${base}/filter`, {
            method: 'POST',
            signal,
            json: {
              ...searchBody(def.fields, search, page, FETCH_SIZE, sort, filters),
              include: ['associations'],
            },
          })
        : await api<RecordsPage>(
            `${base}?${new URLSearchParams({
              page: String(page),
              page_size: String(FETCH_SIZE),
              include: 'associations',
              ...(sort ? { sort: `${sort.field},${sort.direction}` } : {}),
            })}`,
            { signal },
          );
    rows.push(...result.results);
    total = result.metadata.total_elements;
    if (!result.metadata.has_next || rows.length >= maxRows) break;
  }
  return { rows: rows.slice(0, maxRows), total };
}

/**
 * Contacts, companies, deals or any other object: one sheet holding every record, with search
 * and server-side sorting, and a side drawer to add, edit or delete one. There is no paging: like
 * a spreadsheet, you scroll.
 *
 * The URL is the source of truth for everything a person could want to share, bookmark or
 * come back to: `?q=` (search), `?sort=&order=`, `?open=<id>` (the record in the
 * drawer) and `?new=1` (the add drawer). Changing any of them rewrites the URL, and loading
 * a URL restores them.
 */
type FacetMeta = { headerFacets: Record<string, Map<unknown, number>> };
const getHeaderFacets = (table: Table<RecordRow>, columnId: string) => () =>
  (table.options.meta as FacetMeta).headerFacets[columnId] ?? new Map<unknown, number>();

export function RecordsView({ object, maxRows = MAX_ROWS }: { object: string; maxRows?: number }) {
  const client = useQueryClient();
  const sheetElement = useRef<HTMLDivElement>(null);
  const creatingWithTab = useRef(false);
  const editingWithTab = useRef(false);
  const focusAfterCreate = useRef<{ id: string; next: boolean } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [reload, setReload] = useState(0);
  const [schemaReload, setSchemaReload] = useState(0);
  const definitionQuery = useQuery({
    queryKey: ['object-definition', object, schemaReload],
    queryFn: async ({ signal }) => ({ object, ...(await loadDefinition(object, signal)) }),
    placeholderData: keepPreviousData,
  });
  const definition: Definition | null = definitionQuery.data ?? null;
  const permissionQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: ({ signal }) => api<{ can_manage_objects: boolean }>('/api/v1/me', { signal }),
  });
  const canManage = permissionQuery.data?.can_manage_objects === true;
  const peopleQuery = useQuery({
    queryKey: ['directory'],
    queryFn: async ({ signal }) => {
      const [members, teams] = await Promise.all([
        api<{ results: { user_id: string; name: string }[] }>('/api/v1/members', { signal }),
        api<{ results: { id: string; name: string }[] }>('/api/v1/teams', { signal }),
      ]);
      return {
        members: members.results.map((m) => ({ value: m.user_id, label: m.name })),
        teams: teams.results.map((t) => ({ value: t.id, label: t.name })),
      };
    },
  });
  const people = peopleQuery.data ?? NO_PEOPLE;
  const [highlightedRowId, setHighlightedRowId] = useState<string>();

  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<string | null>(null);
  // Who the record in the drawer is linked to: what it is now, and what it was when it was opened.
  const [links, setLinks] = useState<Links>({});
  const [savedLinks, setSavedLinks] = useState<Links>({});
  const [linksFor, setLinksFor] = useState<string | null>(null);

  const def = definition?.object === object ? definition.def : undefined;

  // What the URL says. Anything invalid in it (a typo, a stale link) is ignored.
  const search = searchParams.get('q')?.trim() ?? '';
  const sortField = searchParams.get('sort');
  const sortOrder = searchParams.get('order') === 'desc' ? 'desc' : 'asc';
  const openParam = searchParams.get('open');
  const creating = searchParams.get('new') === '1';
  // A record is added as a row typed into the sheet, unless it needs more than its first field
  // to be valid (another required field); then it is added in the form, in the drawer.
  const needsForm = def ? def.fields.some((f, i) => i > 0 && f.required && !f.read_only) : false;
  const addingRow = creating && def !== undefined && !needsForm;
  const addingField = canManage && searchParams.get('add_field') === '1';
  const editingField = canManage ? searchParams.get('edit_field') : null;
  const filterKey = searchParams.getAll('f').join('\n');
  const filters = useMemo(
    () => (def ? parseFilters(filterKey.split('\n'), def.fields) : []),
    [def, filterKey],
  );
  const sort = useMemo<Sort | null>(
    () =>
      def && sortField && def.fields.some((f) => f.name === sortField && f.filterable)
        ? { field: sortField, direction: sortOrder }
        : null,
    [def, sortField, sortOrder],
  );

  /** Change some of the URL's parameters (null removes one) without adding to the history. */
  const update = useCallback(
    (changes: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        next.delete(key);
        if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
        else if (value !== null) next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const { openRowId, open: openRow } = useRowDrawer({
    openRowId: openParam,
    onOpenRowIdChange: (id) => update({ open: id, new: null }),
  });

  const query = JSON.stringify([
    def?.id,
    def?.version,
    search,
    sort,
    filters,
    reload,
    schemaReload,
  ]);
  const recordsKey = ['records', object, query, maxRows] as const;
  const recordsQuery = useQuery({
    queryKey: recordsKey,
    enabled: !!def,
    queryFn: async ({ signal }) => ({
      query,
      ...(await fetchAll(def!, search, sort, filters, maxRows, signal)),
    }),
    placeholderData: keepPreviousData,
  });
  const loaded: Loaded | undefined = recordsQuery.error
    ? { ...recordsQuery.data, query, problem: messageOf(recordsQuery.error) }
    : recordsQuery.data;
  const rows = loaded?.rows ?? NO_ROWS;
  const total = loaded?.total ?? 0;

  const facetFields = useMemo(
    () => (def?.fields ?? []).filter((field) => headerFilterKind(field) === 'values'),
    [def],
  );
  const facetQueries = useQueries({
    queries: facetFields.map((field) => {
      const others = filters.filter((filter) => filter.field !== field.name);
      return {
        queryKey: [
          'record-facets',
          object,
          field.name,
          def?.version,
          search,
          JSON.stringify(others),
          reload,
        ],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api<{ results: FacetEntry[]; truncated: boolean }>(
            `/api/v1/objects/${object}/records/facets`,
            {
              method: 'POST',
              signal,
              json: { field: field.name, ...searchBody(def!.fields, search, 1, 1, null, others) },
            },
          ),
      };
    }),
  });
  const facetKey = JSON.stringify(facetQueries.map((query) => query.data?.results ?? []));
  const facets = useMemo<FieldFacets>(() => {
    const entries = JSON.parse(facetKey) as FacetEntry[][];
    return Object.fromEntries(facetFields.map((field, index) => [field.name, entries[index]]));
  }, [facetKey, facetFields]);
  const readyFacets = facetFields
    .filter((_, index) => !!facetQueries[index].data)
    .map((field) => field.name)
    .join('\n');
  const facetProblem = facetQueries.find((query) => query.isError)?.error;
  const headerFacets = Object.fromEntries(
    facetFields.map((field) => [
      field.name,
      new Map(
        (facets[field.name] ?? []).map((entry) => [
          headerValue(field, entry.value, people.members),
          entry.count,
        ]),
      ),
    ]),
  );
  const urlColumnFilters = useMemo(
    () => toHeaderFilters(def?.fields ?? [], filters, people.members),
    [def, filters, people.members],
  );
  const headerVersion = JSON.stringify([def?.version, filterKey, people.members]);
  const [seenHeaderVersion, setSeenHeaderVersion] = useState(headerVersion);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(urlColumnFilters);
  if (seenHeaderVersion !== headerVersion) {
    setSeenHeaderVersion(headerVersion);
    setColumnFilters(urlColumnFilters);
  }
  useEffect(() => {
    if (!def || JSON.stringify(columnFilters) === JSON.stringify(urlColumnFilters)) return;
    const timer = setTimeout(() => {
      const next = mergeHeaderFilters(
        def.fields,
        urlColumnFilters,
        columnFilters,
        filters,
        facets,
        people.members,
      );
      update({ f: next.length ? next.map(encodeFilter) : null });
    }, 250);
    return () => clearTimeout(timer);
  }, [def, columnFilters, urlColumnFilters, filters, facets, people.members, update]);

  // The row that was just added or changed is highlighted for a moment.
  useEffect(() => {
    if (!highlightedRowId) return;
    const timer = setTimeout(() => setHighlightedRowId(undefined), 1500);
    return () => clearTimeout(timer);
  }, [highlightedRowId]);

  const linksQuery = useQuery({
    queryKey: ['record-links', object, openRowId, def?.version, reload],
    enabled: !!def && !!openRowId && (def.associations?.length ?? 0) > 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) =>
      Object.fromEntries(
        await Promise.all(
          (def!.associations ?? []).map(async (kind) => {
            const page = await api<{ results: Linked[] }>(
              `/api/v1/objects/${def!.name}/records/${openRowId}/associations/${kind.name}?page_size=100`,
              { signal },
            );
            return [
              kind.name,
              page.results.map((row) => ({ id: row.id, label: row.label })),
            ] as const;
          }),
        ),
      ),
  });
  // Seed the draft once per completed fetch without overwriting edits on later renders.
  const [hydratedLinks, setHydratedLinks] = useState<string | null>(null);
  const linksGeneration = `${openRowId}:${linksQuery.dataUpdatedAt}`;
  if (
    openRowId &&
    linksQuery.data &&
    !linksQuery.isFetching &&
    !linksQuery.isError &&
    hydratedLinks !== linksGeneration
  ) {
    setHydratedLinks(linksGeneration);
    setLinks(linksQuery.data);
    setSavedLinks(linksQuery.data);
    setLinksFor(openRowId);
  }
  const linkProblem =
    linksQuery.error && openRowId
      ? { recordId: openRowId, message: messageOf(linksQuery.error) }
      : null;

  const listed = rows.some((row) => row.id === openRowId);
  const openedQuery = useQuery({
    queryKey: ['record', object, openRowId],
    enabled: !!def && !!openRowId && !listed,
    queryFn: ({ signal }) =>
      api<RecordRow>(`/api/v1/objects/${def!.name}/records/${openRowId}`, { signal }),
  });
  const opened = openedQuery.data;
  const missingRecord = openedQuery.isError && !listed && !!openRowId;
  const [missingRecordId, setMissingRecordId] = useState<string | null>(null);
  if (missingRecord && missingRecordId !== openRowId) {
    setMissingRecordId(openRowId);
    setNotice('That record no longer exists, or you cannot see it.');
  }
  useEffect(() => {
    if (!missingRecord) return;
    update({ open: null });
  }, [missingRecord, update]);

  const label = def?.label.toLowerCase() ?? '';
  const fieldLabels = useMemo(
    () => Object.fromEntries((def?.fields ?? []).map((f) => [f.name, f.label])),
    [def],
  );
  const fields = def?.fields;
  const associations = def?.associations;

  // Linking or unlinking from a cell saves at once; the row then shows the new set.
  const objectName = def?.name;
  const invalidateRecords = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['records', object], refetchType: 'none' });
    void client.invalidateQueries({ queryKey: ['link-search'], refetchType: 'none' });
    void client.invalidateQueries({ queryKey: ['record', object], refetchType: 'none' });
    void client.invalidateQueries({ queryKey: ['record-history', object], refetchType: 'none' });
    void client.invalidateQueries({ queryKey: ['record-links'], refetchType: 'none' });
    void client.invalidateQueries({ queryKey: ['record-facets', object], refetchType: 'none' });
  }, [client, object]);
  const changeLink = useCallback(
    async (recordId: string, kind: string, record: Linked, action: 'link' | 'unlink') => {
      const base = `/api/v1/objects/${objectName}/records/${recordId}/associations/${kind}`;
      if (action === 'link') await api(base, { method: 'POST', json: { record_id: record.id } });
      else await api(`${base}/${record.id}`, { method: 'DELETE' });
      invalidateRecords();
      // Where a record holds only one, linking another takes the place of the one it had.
      const holdsOne = associations?.some((a) => a.name === kind && !a.many) === true;
      client.setQueryData<Loaded>(['records', object, query, maxRows], (current) => {
        if (!current?.rows) return current;
        const change = (r: RecordRow): RecordRow => {
          const now = r.associations?.[kind] ?? [];
          const next =
            action === 'link'
              ? holdsOne
                ? [record]
                : now.some((l) => l.id === record.id)
                  ? now
                  : [...now, record]
              : now.filter((l) => l.id !== record.id);
          return { ...r, associations: { ...r.associations, [kind]: next } };
        };
        return { ...current, rows: current.rows.map((r) => (r.id === recordId ? change(r) : r)) };
      });
    },
    [objectName, associations, client, object, query, maxRows, invalidateRecords],
  );
  /** Saves the row typed into at the bottom: the first field's value makes the record. */
  const createFromRow = useCallback(
    async (text: string) => {
      if (!def) return { error: 'Not loaded yet.' };
      try {
        const saved = await api<RecordRow>(`/api/v1/objects/${def.name}/records`, {
          method: 'POST',
          json: { properties: propertiesFromChanges(def.fields, { [def.fields[0].name]: text }) },
        });
        invalidateRecords();
        if (creatingWithTab.current) {
          focusAfterCreate.current = { id: saved.id, next: true };
          creatingWithTab.current = false;
        }
        update({ new: null });
        setHighlightedRowId(saved.id);
        setReload((n) => n + 1);
        return undefined;
      } catch (error) {
        if (creatingWithTab.current) {
          focusAfterCreate.current = { id: NEW_ROW_ID, next: false };
          creatingWithTab.current = false;
        }
        return { error: messageOf(error) };
      }
    },
    [def, update, invalidateRecords],
  );

  const columns = useMemo(() => {
    const fieldColumns = (fields ? columnsFor(fields) : []).map((field, index) =>
      col.accessor((row) => row.properties[field.name], {
        id: field.name,
        // A cog beside the name opens the field's settings; it is only there for those who may change them.
        header: canManage
          ? () => (
              <span className="flex items-center gap-1">
                {field.label}
                <button
                  type="button"
                  aria-label={`Settings for ${field.label}`}
                  title="Field settings"
                  onClick={() =>
                    update({ edit_field: field.name, new: null, open: null, add_field: null })
                  }
                  className="text-sheet-fg/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-sheet-fg focus-visible:opacity-100"
                >
                  <Settings className="size-3" aria-hidden />
                </button>
              </span>
            )
          : field.label,
        size: index === 0 ? Math.max(widthOf(field), 280) : widthOf(field), // the name needs room
        enableSorting: field.filterable,
        enableColumnFilter: headerFilterKind(field) !== undefined,
        filterFn:
          headerFilterKind(field) === 'text'
            ? textFilter
            : readyFacets.split('\n').includes(field.name)
              ? valuesFilter
              : undefined,
        cell: ({ row }) => {
          if (row.original.id === NEW_ROW_ID) {
            // The row being added: type the first field and press Enter; the rest is filled in after.
            return index === 0 ? (
              <div
                data-record-id={NEW_ROW_ID}
                className="w-full"
                onKeyDownCapture={(event) => {
                  if (
                    event.key !== 'Tab' ||
                    event.shiftKey ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.altKey ||
                    event.nativeEvent.isComposing ||
                    !(event.target instanceof HTMLInputElement)
                  )
                    return;
                  event.preventDefault();
                  creatingWithTab.current = true;
                  event.target.blur();
                }}
              >
                <SheetEditableTextCell
                  {...{ autoFocus: true }}
                  value=""
                  placeholder={`New ${label}`}
                  onCommit={createFromRow}
                  onCancel={() => {
                    if (creatingWithTab.current) focusAfterCreate.current = { id: '', next: false };
                    creatingWithTab.current = false;
                    update({ new: null });
                  }}
                />
              </div>
            ) : null;
          }
          const raw = row.original.properties[field.name];
          const text = formatValue(field, raw);
          const editable = inPlace(field);
          if (index === 0) {
            return (
              <div data-record-id={row.id} className="w-full">
                <SheetPrimaryCell
                  onOpen={() => openRow(row.id)}
                  openLabel={`Open ${label}`}
                  editable={
                    editable
                      ? { value: raw == null ? '' : String(raw), placeholder: field.label }
                      : undefined
                  }
                >
                  {text || `Untitled ${label}`}
                </SheetPrimaryCell>
              </div>
            );
          }
          if (editable && field.type === 'USER') {
            const ids = memberIds(raw);
            return field.config.many ? (
              <UsersCell
                label={field.label}
                rowLabel={def ? recordLabel(def, row.original) : row.id}
                value={ids}
                members={people.members}
              />
            ) : (
              <PickCell label={field.label} value={ids[0] ?? ''} options={people.members} />
            );
          }
          if (editable && field.type === 'ENUM')
            return <ChoiceCell field={field} value={raw == null ? '' : String(raw)} />;
          if (editable && field.type === 'TIMESTAMP')
            return <DateCell field={field} value={raw == null ? '' : String(raw).slice(0, 10)} />;
          if (editable && field.type === 'BOOLEAN')
            return <CheckCell field={field} value={raw === true} />;
          if (editable) {
            return (
              <SheetEditableTextCell
                stage
                value={raw == null ? '' : String(raw)}
                className={field.type === 'NUMBER' ? 'text-right tabular-nums' : undefined}
              />
            );
          }
          return (
            <SheetTextCell
              className={field.type === 'NUMBER' ? 'text-right tabular-nums' : undefined}
            >
              {text}
            </SheetTextCell>
          );
        },
      }),
    ) as ColumnDef<RecordRow, unknown>[];
    // One column per kind of record this one can be linked to, showing who it is linked to.
    const linkColumns = (associations ?? []).map(
      (kind) =>
        col.display({
          id: `link:${kind.name}`,
          header: kind.label,
          size: 240,
          enableSorting: false,
          cell: ({ row }) =>
            row.original.id === NEW_ROW_ID ? null : (
              <LinkCell
                kind={kind}
                linked={row.original.associations?.[kind.name] ?? []}
                rowLabel={def ? recordLabel(def, row.original) : row.id}
                onChange={(record, action) => changeLink(row.id, kind.name, record, action)}
              />
            ),
        }) as ColumnDef<RecordRow, unknown>,
    );
    fieldColumns.push(...linkColumns);
    // Whose each record is, and which team's: they decide who can see and change it.
    const ownership = [
      { id: 'record_owner', header: 'Owner', key: 'owner_id' as const, options: people.members },
      { id: 'record_team', header: 'Team', key: 'team_id' as const, options: people.teams },
    ].map(
      (column) =>
        col.display({
          id: column.id,
          header: column.header,
          size: 170,
          enableSorting: false,
          cell: ({ row }) =>
            row.original.id === NEW_ROW_ID ? null : (
              <PickCell
                label={column.header}
                value={row.original[column.key] ?? ''}
                options={column.options}
              />
            ),
        }) as ColumnDef<RecordRow, unknown>,
    );
    fieldColumns.push(...ownership);
    if (!canManage || !fields) return fieldColumns;
    // The last column is where a new one is added, the way a spreadsheet has it.
    const addField = col.display({
      id: 'add_field',
      size: 48,
      enableSorting: false,
      header: () => (
        <button
          type="button"
          aria-label="Add field"
          title="Add field"
          onClick={() => update({ add_field: '1', new: null, open: null })}
          className="flex size-full items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      ),
      cell: () => null,
    }) as ColumnDef<RecordRow, unknown>;
    return [...fieldColumns, addField];
  }, [
    def,
    fields,
    associations,
    label,
    openRow,
    canManage,
    update,
    changeLink,
    createFromRow,
    readyFacets,
    people,
  ]);

  // Edits made in the cells are saved a row at a time, and the sheet shows how each one went.
  const cellStatus = useCellStatus();
  const rowChanges = useRowChanges({
    cellStatus,
    onSubmitRow: async (recordId, changes) => {
      if (!def) return { error: 'Not loaded yet.' };
      try {
        const saved = await api<RecordRow>(`/api/v1/objects/${def.name}/records/${recordId}`, {
          method: 'PATCH',
          json: bodyFromChanges(def.fields, changes),
        });
        invalidateRecords();
        client.setQueryData<Loaded>(['records', object, query, maxRows], (current) =>
          current?.rows
            ? {
                ...current,
                rows: current.rows.map((r) =>
                  r.id === recordId ? { ...saved, associations: r.associations } : r,
                ),
              }
            : current,
        );
        return undefined;
      } catch (error) {
        if (error instanceof ApiError && error.errors.length > 0) {
          const fieldErrors: Record<string, string[]> = {};
          for (const e of error.errors) (fieldErrors[e.field] ??= []).push(e.message);
          return { error: error.message, fieldErrors };
        }
        return { error: messageOf(error) };
      }
    },
  });

  // The temporary creation row disappears after saving. Restore Tab's destination
  // in the persisted row only once that row has actually reached the sheet.
  useEffect(() => {
    const pending = focusAfterCreate.current;
    const root = sheetElement.current;
    if (!pending || !root) return;
    const row = root
      .querySelector(`[data-record-id="${CSS.escape(pending.id)}"]`)
      ?.closest('[role="row"]');
    if (!row) {
      if (recordsQuery.isFetching || addingRow) return;
      focusAfterCreate.current = null;
      root
        .querySelector<HTMLButtonElement>(
          '[role="row"] > [role="cell"]:first-child > button[aria-label^="Add "]',
        )
        ?.focus();
      return;
    }
    const cells = Array.from(row.querySelectorAll<HTMLElement>(':scope > [role="cell"]'));
    const destination = (pending.next ? cells.slice(1) : cells)
      .flatMap((cell) =>
        Array.from(
          cell.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
          ),
        ),
      )
      .find((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    focusAfterCreate.current = null;
    destination?.focus();
  }, [rows, addingRow, recordsQuery.isFetching, cellStatus.statuses]);

  // While a record is being added, its row is the last one in the sheet, pinned so it stays in view.
  const tableRows = useMemo(
    () =>
      addingRow
        ? [
            ...rows,
            {
              id: NEW_ROW_ID,
              object,
              properties: {},
              owner_id: null,
              team_id: null,
              created_at: '',
              updated_at: '',
            } satisfies RecordRow,
          ]
        : rows,
    [addingRow, rows, object],
  );

  // Sorting happens on the server, so the sheet only reports what was asked for.
  const sorting: SortingState = useMemo(
    () => (sort ? [{ id: sort.field, desc: sort.direction === 'desc' }] : []),
    [sort],
  );
  const sheet = useSheet({
    columns,
    data: tableRows,
    getRowId: (row) => row.id,
    cellStatus,
    rowChanges,
    manualSorting: true,
    manualFiltering: true,
    meta: { headerFacets },
    getFacetedUniqueValues: getHeaderFacets,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters, rowPinning: addingRow ? PIN_NEW_ROW : PIN_NOTHING },
    onSortingChange: (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      update({
        sort: next[0]?.id ?? null,
        order: next[0] ? (next[0].desc ? 'desc' : 'asc') : null,
      });
    },
  });

  if (definition === null || (definition.object !== object && !definition.problem)) {
    return (
      <div aria-live="polite" aria-label="Loading records" className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-3 border-t pt-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }
  if (!def) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{definition.problem}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => setSchemaReload((n) => n + 1)}>
          <RefreshCw aria-hidden /> Try again
        </Button>
      </div>
    );
  }

  const loading = recordsQuery.isFetching || loaded?.query !== query;
  const sample = SAMPLE_RECORDS[def.name];
  const editing = openRowId
    ? (rows.find((r) => r.id === openRowId) ?? (opened?.id === openRowId ? opened : undefined))
    : undefined;
  const drawerOpen = (creating && needsForm) || editing !== undefined;

  // The form fills itself when the drawer shows a record (or the add form) it was not showing
  // before, however it got there: a click, or a link.
  const formKey = editing ? `edit:${editing.id}` : creating && needsForm ? 'new' : null;
  if (formKey !== formFor) {
    setFormFor(formKey);
    if (formKey !== null) {
      setValues(
        editing ? valuesFromRecord(def.fields, editing.properties) : emptyValues(def.fields),
      );
      setErrors({});
      setFormError(null);
      setConfirmingDelete(false);
      if (!editing) {
        setLinks({});
        setSavedLinks({});
      }
    }
  }

  const openCreate = () => update({ new: '1', open: null, add_field: null });
  const closeDrawer = () => update({ new: null, open: null });
  const closeAddField = () => update({ add_field: null });
  const closeFieldSettings = () => update({ edit_field: null });

  async function save() {
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const base = `/api/v1/objects/${def!.name}/records`;
      const saved = editing
        ? await api<RecordRow>(`${base}/${editing.id}`, {
            method: 'PATCH',
            json: { properties: propertiesFromValues(def!.fields, values, 'update') },
          })
        : await api<RecordRow>(base, {
            method: 'POST',
            json: { properties: propertiesFromValues(def!.fields, values, 'create') },
          });
      invalidateRecords();
      setHighlightedRowId(saved.id);
      setReload((n) => n + 1);

      // Then who it is linked to, for the kinds whose links were changed.
      const linksReady =
        !editing || (linksFor === editing.id && !linksQuery.isError && !linksQuery.isFetching);
      const changed = linksReady
        ? (def!.associations ?? []).filter(
            (kind) => !sameLinks(links[kind.name], savedLinks[kind.name]),
          )
        : [];
      try {
        for (const kind of changed) {
          await api(`${base}/${saved.id}/associations/${kind.name}`, {
            method: 'PUT',
            json: { record_ids: linkIds(links[kind.name]) },
          });
        }
      } catch (error) {
        // The record is saved; what is left is to link it, so stay on it to try again.
        if (!editing) update({ open: saved.id, new: null });
        setFormError(`The ${label} was saved, but linking failed: ${messageOf(error)}`);
        return;
      }
      closeDrawer();
    } catch (error) {
      if (error instanceof ApiError && error.errors.length > 0) {
        setErrors(Object.fromEntries(error.errors.map((e) => [e.field, e.message])));
        // Anything about a field this form does not show would otherwise go unseen.
        const shown = new Set(def!.fields.map((f) => f.name));
        setFormError(error.errors.every((e) => shown.has(e.field)) ? null : error.message);
      } else {
        setFormError(messageOf(error));
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      await api(`/api/v1/objects/${def!.name}/records/${editing.id}`, { method: 'DELETE' });
      invalidateRecords();
      closeDrawer();
      setReload((n) => n + 1);
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  /** The id of the record whose `field` is `value`, if there is one. */
  async function findRecord(object: string, field: string, value: string): Promise<string | null> {
    const page = await api<RecordsPage>(`/api/v1/objects/${object}/records/filter`, {
      method: 'POST',
      json: {
        filter_groups: [{ filters: [{ field_path: field, operator: 'EQUALS', value }] }],
        pagination: { page: 1, page_size: 1 },
      },
    });
    return page.results[0]?.id ?? null;
  }

  async function addSamples() {
    setSeeding(true);
    setNotice(null);
    // What each kind of link points at: a company by its name, a contact by its email.
    const lookup: Record<string, string> = { company: 'name', contact: 'email' };
    try {
      for (const item of (sample ?? []) as Sample[]) {
        const base = `/api/v1/objects/${def!.name}/records`;
        const id =
          (await findRecord(def!.name, item.key.field, item.key.value)) ??
          (await api<RecordRow>(base, { method: 'POST', json: { properties: item.properties } }))
            .id;
        for (const [kind, value] of Object.entries(item.links ?? {})) {
          // The link this object has to that kind of record (a contact's companies; a deal's contacts, from the other end).
          const link = (def!.associations ?? []).find((a) => a.target === kind);
          if (!value || !link) continue;
          // A company the sample names is made if it is not there; a contact only linked if it is.
          const targetId =
            (await findRecord(kind, lookup[kind], value)) ??
            (kind === 'company'
              ? (
                  await api<RecordRow>(`/api/v1/objects/company/records`, {
                    method: 'POST',
                    json: { properties: { name: value } },
                  })
                ).id
              : null);
          if (targetId)
            await api(`${base}/${id}/associations/${link.name}`, {
              method: 'POST',
              json: { record_id: targetId },
            });
        }
      }
    } catch (error) {
      setNotice(`Could not add all the sample data: ${messageOf(error)}`);
    } finally {
      setSeeding(false);
      invalidateRecords();
      setReload((n) => n + 1);
    }
  }

  const emptyState =
    search || filters.length > 0 ? (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="mb-1 flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
          <SearchX className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">No matching records</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No {def.plural_label.toLowerCase()} match {search ? `“${search}”` : 'the filters'}
          {search && filters.length > 0 ? ' and the filters' : ''}.
        </p>
        <Button
          variant="outline"
          className="mt-1"
          onClick={() => {
            update({ q: null, f: null });
          }}
        >
          Clear search and filters
        </Button>
      </div>
    ) : (
      <p data-empty-records className="sticky left-4 flex h-full w-fit items-center gap-1 text-left text-sm">
        <Button
          variant="link"
          className="h-auto p-0 underline underline-offset-4"
          onClick={openCreate}
        >
          Add a new {label}
        </Button>
        {sample && (
          <>
            {' or '}
            <Button
              variant="link"
              className="h-auto p-0 underline underline-offset-4"
              disabled={seeding}
              onClick={addSamples}
            >
              {seeding ? 'Adding…' : 'Add sample data'}
            </Button>
          </>
        )}
      </p>
    );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {def.plural_label}
            </h1>
            <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground sm:text-sm">
              {loaded?.rows
                ? `${total} ${total === 1 ? label : def.plural_label.toLowerCase()}`
                : ' '}
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus aria-hidden /> Add {label}
        </Button>
      </div>
      {search && (
        <div className="flex shrink-0 items-center gap-2 px-4 pb-3 text-sm text-muted-foreground sm:px-6">
          <span className="truncate">Results for “{search}”</span>
          <Button variant="ghost" size="sm" onClick={() => update({ q: null })}>
            Clear search
          </Button>
        </div>
      )}

      <FilterChips
        fields={def.fields}
        people={Object.fromEntries(people.members.map((m) => [m.value, m.label]))}
        filters={filters}
        onChange={(next) => update({ f: next.length ? next.map(encodeFilter) : null })}
      />

      {facetProblem && (
        <div className="px-4 pb-3 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{messageOf(facetProblem)}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              for (const query of facetQueries) if (query.isError) void query.refetch();
            }}
          >
            Retry loading filter choices
          </Button>
        </div>
      )}
      {facetQueries.some((query) => query.data?.truncated) && (
        <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-6">
          Column checklists show up to 1,000 distinct values. Counts include all matching records.
        </p>
      )}

      {(notice || loaded?.problem) && (
        <div className="px-4 pb-4 sm:px-6">
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertDescription>{notice ?? loaded?.problem}</AlertDescription>
          </Alert>
          {loaded?.problem && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setReload((n) => n + 1)}
            >
              <RefreshCw aria-hidden /> Try again
            </Button>
          )}
        </div>
      )}

      <div
        ref={sheetElement}
        aria-busy={loading}
        className="min-h-0 min-w-0 flex-1 border-t"
        onKeyDownCapture={(event) => {
          if (
            event.key !== 'Tab' ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.nativeEvent.isComposing
          )
            return;
          editingWithTab.current =
            (event.target instanceof HTMLInputElement ||
              event.target instanceof HTMLSelectElement ||
              event.target instanceof HTMLTextAreaElement) &&
            !!event.target.closest('[role="cell"]');
        }}
        onFocusCapture={(event) => {
          if (!editingWithTab.current) return;
          editingWithTab.current = false;
          const target = event.target;
          if (target instanceof HTMLButtonElement && target.classList.contains('cursor-text'))
            target.click();
        }}
      >
        <Sheet
          instance={sheet}
          isLoading={!loaded?.rows && !loaded?.problem}
          emptyState={emptyState}
          onAddRow={addingRow ? undefined : openCreate}
          labels={{
            addRow: `Add ${label}`,
            // A header that is not plain text is named by the column's id, so name it properly.
            filter: (id) => `Filter ${fieldLabels[id] ?? id}`,
            filterText: (id) => `${fieldLabels[id] ?? id} contains`,
            sort: (id) => `Sort ${fieldLabels[id] ?? id}`,
            resize: (id) => `Resize ${fieldLabels[id] ?? id}`,
          }}
          openRowId={openRowId}
          highlightedRowId={highlightedRowId}
          className={
            `transition-opacity [&_[role=cell]:has(>[data-empty-records])]:h-8 [&_[role=cell]:has(>[data-empty-records])]:py-0 ${loading && loaded?.rows ? 'opacity-60' : ''}`
          }
        />
      </div>

      {total > rows.length && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-6">
          Showing the first {rows.length} of {total} {def.plural_label.toLowerCase()}. Use Cmd+K to
          narrow them down.
        </p>
      )}

      <FieldSettingsDrawer
        object={def.name}
        fields={def.fields}
        editing={editingField}
        hasRecords={total > 0}
        onClose={closeFieldSettings}
        onChanged={() => {
          setSchemaReload((n) => n + 1);
          void client.invalidateQueries({ queryKey: ['objects'] });
        }}
      />

      <AddFieldDrawer
        object={def.name}
        label={label}
        open={addingField}
        hasRecords={total > 0}
        onClose={closeAddField}
        onAdded={() => {
          closeAddField();
          void client.invalidateQueries({ queryKey: ['objects'] });
          setSchemaReload((n) => n + 1);
        }}
      />

      <Drawer open={drawerOpen} onOpenChange={(isOpen) => !isOpen && !saving && closeDrawer()}>
        <DrawerContent>
          <DrawerHeader>
            {editing && (
              <p className="text-xs font-medium text-muted-foreground">{def.label} details</p>
            )}
            <DrawerTitle>{editing ? recordLabel(def, editing) : `Add ${label}`}</DrawerTitle>
            <DrawerDescription>
              {editing
                ? 'Update details, manage relationships, and review activity.'
                : `Fill in the details of the new ${label}.`}
            </DrawerDescription>
          </DrawerHeader>
          {formError && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <DrawerBody>
            <RecordForm
              id="record-form"
              fields={def.fields}
              values={values}
              errors={errors}
              onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
              members={people.members}
              onSubmit={save}
            />
            {editing && linkProblem?.recordId === editing.id ? (
              <div
                role="alert"
                className="mt-6 space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"
              >
                <p className="text-sm font-medium">Could not load linked records</p>
                <p className="text-xs text-destructive">{linkProblem.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void linksQuery.refetch();
                  }}
                >
                  Retry links
                </Button>
              </div>
            ) : (
              <RecordLinks
                associations={def.associations ?? []}
                value={links}
                loading={editing !== undefined && linksFor !== editing.id}
                onChange={(name, linked) => setLinks((current) => ({ ...current, [name]: linked }))}
              />
            )}
            {editing && (
              <RecordTimeline
                def={def}
                recordId={editing.id}
                version={editing.updated_at}
                members={people.members}
              />
            )}
          </DrawerBody>
          <DrawerFooter>
            {editing && (
              <div className="mr-auto flex gap-2">
                {confirmingDelete ? (
                  <>
                    <Button variant="destructive" disabled={saving} onClick={remove}>
                      Yes, delete
                    </Button>
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="destructive"
                    disabled={saving}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
            <Button variant="outline" disabled={saving} onClick={closeDrawer}>
              Cancel
            </Button>
            <Button type="submit" form="record-form" disabled={saving}>
              {saving && (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
              )}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
