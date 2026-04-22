'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import { CommentBox } from './CommentBox';
import { MarkdownContent } from './MarkdownContent';
import clsx from 'clsx';

const ACTIVITY_SOURCES = { AI: 'ai' } as const;
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button, Divider, Subheading } from '@zuko/ui-kit';
import { toast } from 'sonner';
import { getTimeline } from '@/server/query-options';
import { activitiesApi } from '@/lib/api/activities';
import dayjs from 'dayjs';
import { EMPTY_VALUE } from '@/components/Table';
import { formatStage } from '@/lib/format-utils';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);



const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  value: 'value',
  probability: 'probability',
  expectedCloseDate: 'expected close date',
  priority: 'priority',
};

function formatFieldName(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function formatFieldValue(field: string, val: unknown): string {
  if (val === null || val === undefined) return EMPTY_VALUE;
  if (field === 'expectedCloseDate' || field === 'actualCloseDate') {
    return dayjs(String(val)).format('MMM D, YYYY');
  }
  if (field === 'probability') return `${val}%`;
  if (field === 'value') return String(val);
  return String(val);
}

function renderSystemEventText(activity: {
  activityType: string;
  metadata?: Record<string, unknown> | null;
}) {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  switch (activity.activityType) {
    case 'deal_created':
      return 'created this deal';
    case 'company_created':
      return 'created this company';
    case 'contact_created':
      return 'created this contact';
    case 'task_created':
      return 'created this task';
    case 'subtask_added':
      return `added subtask "${m.subtaskTitle}"`;

    case 'task_status_changed': {
      const TASK_STATUS_LABELS: Record<string, string> = {
        TODO: 'To Do',
        IN_PROGRESS: 'In Progress',
        DONE: 'Done',
        CANCELLED: 'Cancelled',
      };
      const fromLabel = TASK_STATUS_LABELS[String(m.from)] ?? String(m.from);
      const toLabel = TASK_STATUS_LABELS[String(m.to)] ?? String(m.to);
      return `moved task from ${fromLabel} to ${toLabel}`;
    }
    case 'stage_change':
      return `moved deal from ${formatStage(String(m.from))} to ${formatStage(String(m.to))}`;
    case 'field_update': {
      const fieldName = formatFieldName(String(m.field));
      const isRichTextField = ['summary', 'notes', 'description'].includes(String(m.field));
      if (isRichTextField) {
        const hasOldValue = m.from !== null && m.from !== undefined;
        return hasOldValue ? `updated ${fieldName}` : `set ${fieldName}`;
      }
      const newVal = formatFieldValue(String(m.field), m.to);
      const oldVal =
        m.from === null || m.from === undefined
          ? null
          : formatFieldValue(String(m.field), m.from);
      return oldVal
        ? `updated ${fieldName} from "${oldVal}" to "${newVal}"`
        : `set ${fieldName} to "${newVal}"`;
    }
    case 'deal_closed':
      return m.outcome === 'won'
        ? 'marked deal as Won'
        : `marked deal as Lost${m.lostReason ? `: ${m.lostReason}` : ''}`;
    case 'company_linked':
      return `linked company ${m.companyName}`;
    case 'company_unlinked':
      return `unlinked company ${m.companyName}`;
    case 'contact_linked':
      return `linked contact ${m.contactName}${m.role ? ` as ${m.role}` : ''}`;
    case 'contact_unlinked':
      return `unlinked contact ${m.contactName}`;
    case 'owner_assigned':
      return `assigned ${m.userName} as owner`;
    case 'owner_removed':
      return `removed ${m.userName} as owner`;
    default:
      return activity.activityType;
  }
}

interface ActivityTimelineProps {
  entityType: string;
  entityId: number;
  currentUserId?: number; // TODO: Get from auth context
  limit?: number;
  hideTimeline?: boolean;
}

export default function ActivityTimeline({
  entityType,
  entityId,
  currentUserId,
  limit = 50,
  hideTimeline = false,
}: ActivityTimelineProps) {
  const queryClient = useQueryClient();
  const [editingActivityId, setEditingActivityId] = useState<number | null>(
    null,
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const clearNewCommentRef = useRef<{ clear: () => void } | null>(null);

  const { data: activities, isLoading } = useQuery(
    getTimeline(entityType, entityId, limit),
  );

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => {
      if (!currentUserId) {
        throw new Error('User ID is required to create a comment');
      }
      return activitiesApi.createComment(entityType, entityId, {
        content,
        userId: currentUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['timeline', entityType, entityId],
      });
      clearNewCommentRef.current?.clear();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to post comment');
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({
      activityId,
      content,
    }: {
      activityId: number;
      content: string;
    }) => {
      if (!currentUserId) {
        throw new Error('User ID is required to update an activity');
      }
      return activitiesApi.updateActivity(activityId, {
        content,
        userId: currentUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['timeline', entityType, entityId],
      });
      setEditingActivityId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update comment');
    },
  });

  const handleEdit = (activityId: number) => {
    setEditingActivityId(activityId);
  };

  const handleEditSubmit = (content: string) => {
    if (editingActivityId) {
      updateActivityMutation.mutate({ activityId: editingActivityId, content });
    }
  };

  const handleCancel = () => {
    setEditingActivityId(null);
  };

  return (
    <div className="mt-12 space-y-6">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <Subheading>Activity</Subheading>
        {!hideTimeline && (
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center gap-1.5 py-1 text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-all group"
          >
            <span className="text-xs font-bold uppercase tracking-widest">
              {isHistoryOpen ? 'Hide History' : 'Show History'}
            </span>
            {isHistoryOpen ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Timeline Accordion */}
      {!hideTimeline && isHistoryOpen && (
        <div className="animate-in fade-in duration-300">
          <div className="space-y-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Loading timeline...
                </div>
              </div>
            ) : !activities || activities.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-600 dark:text-zinc-400">
                No activity yet
              </div>
            ) : (
              activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={clsx("flex gap-3", index < activities.length - 1 && "pb-6")}
                  data-testid="activity-item"
                >
                  {/* Avatar with connecting line */}
                  <div className="flex-shrink-0 relative">
                    {/* Vertical connecting line */}
                    {index < activities.length - 1 && (
                      <div
                        className="absolute left-4 top-8 bottom-0 w-[2px] -mb-6 bg-zinc-200 dark:bg-zinc-800"
                        data-testid="activity-connecting-line"
                      />
                    )}

                    {activity.actor?.image ? (
                      <Image
                        src={activity.actor.image}
                        alt={activity.actor.name}
                        width={32}
                        height={32}
                        className="relative rounded-full border-2 border-white dark:border-zinc-950 bg-zinc-100 dark:bg-zinc-800"
                        data-testid="activity-avatar"
                      />
                    ) : (
                      <div
                        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-950"
                        data-testid="activity-avatar"
                      >
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {activity.actor?.name?.charAt(0).toUpperCase() ||
                            (activity.metadata?.source === ACTIVITY_SOURCES.AI
                              ? 'Z'
                              : 'S')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-950 dark:text-white">
                            {activity.actor?.name ||
                              (activity.metadata?.source === ACTIVITY_SOURCES.AI
                                ? 'Zuko AI'
                                : 'System')}
                          </span>
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            {dayjs(activity.createdAt).fromNow()}
                          </span>
                        </div>

                        {activity.activityType === 'comment' &&
                          activity.content && (
                            <>
                              {editingActivityId === activity.id ? (
                                <div className="mt-2">
                                  <CommentBox
                                    initialContent={activity.content ?? undefined}
                                    onSubmit={handleEditSubmit}
                                    isSubmitting={updateActivityMutation.isPending}
                                    submitLabel={
                                      updateActivityMutation.isPending
                                        ? 'Saving...'
                                        : 'Save'
                                    }
                                    onCancel={handleCancel}
                                  />
                                </div>
                              ) : (
                                <div className="mt-1">
                                  <MarkdownContent content={activity.content} />
                                </div>
                              )}
                            </>
                          )}

                        {activity.activityType !== 'comment' && (
                          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 italic">
                            {renderSystemEventText(activity)}
                          </div>
                        )}
                      </div>

                      {activity.activityType === 'comment' &&
                        currentUserId &&
                        activity.actorId === currentUserId &&
                        editingActivityId !== activity.id && (
                          <Button
                            plain
                            onClick={() => handleEdit(activity.id)}
                            disabled={updateActivityMutation.isPending}
                            className="text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Edit comment"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Comment Input Form - Always Visible */}
      {currentUserId && (
        <div className="mt-6 space-y-6">
          <Divider />
          <CommentBox
            title="Add a comment"
            onSubmit={(content) => createCommentMutation.mutate(content)}
            isSubmitting={createCommentMutation.isPending}
            submitLabel={
              createCommentMutation.isPending ? 'Posting...' : 'Post Comment'
            }
            onReady={(api) => {
              clearNewCommentRef.current = api;
            }}
          />
        </div>
      )}
    </div>
  );
}
