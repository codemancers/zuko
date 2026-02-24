'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PencilIcon } from '@heroicons/react/24/outline';
import { Button, Divider } from '@zuko/ui-kit';
import { getTimeline } from '@/server/query-options';
import { activitiesApi } from '@/lib/api/activities';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface ActivityTimelineProps {
  entityType: string;
  entityId: number;
  currentUserId?: number; // TODO: Get from auth context
  limit?: number;
}

export default function ActivityTimeline({
  entityType,
  entityId,
  currentUserId,
  limit = 50,
}: ActivityTimelineProps) {
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();
  const [editingActivityId, setEditingActivityId] = useState<number | null>(
    null
  );
  const [editedContent, setEditedContent] = useState('');

  const { data: activities, isLoading } = useQuery(
    getTimeline(entityType, entityId, limit)
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
      setComment('');
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
      setEditedContent('');
    },
  });

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      createCommentMutation.mutate(comment.trim());
    }
  };

  const handleEdit = (activityId: number, currentContent: string) => {
    setEditingActivityId(activityId);
    setEditedContent(currentContent);
  };

  const handleSave = (activityId: number) => {
    if (
      editedContent.trim() &&
      editedContent.trim() !==
        activities?.find((a) => a.id === activityId)?.content
    ) {
      updateActivityMutation.mutate({
        activityId,
        content: editedContent.trim(),
      });
    }
  };

  const handleCancel = () => {
    setEditingActivityId(null);
    setEditedContent('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading timeline...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <div className="space-y-0">
        {!activities || activities.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-600 dark:text-zinc-400">
            No activity yet
          </div>
        ) : (
          activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex gap-3 pb-6"
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
                  <img
                    src={activity.actor.image}
                    alt={activity.actor.name}
                    className="relative h-8 w-8 rounded-full border-2 border-white dark:border-zinc-950 bg-zinc-100 dark:bg-zinc-800"
                    data-testid="activity-avatar"
                  />
                ) : (
                  <div
                    className="relative flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-950"
                    data-testid="activity-avatar"
                  >
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {activity.actor?.name?.charAt(0).toUpperCase() || 'S'}
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
                        {activity.actor?.name || 'System'}
                      </span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {dayjs(activity.createdAt).fromNow()}
                      </span>
                    </div>

                    {activity.activityType === 'comment' &&
                      activity.content && (
                        <>
                          {editingActivityId === activity.id ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editedContent}
                                onChange={(e) =>
                                  setEditedContent(e.target.value)
                                }
                                rows={3}
                                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleSave(activity.id)}
                                  disabled={
                                    !editedContent.trim() ||
                                    updateActivityMutation.isPending
                                  }
                                >
                                  {updateActivityMutation.isPending
                                    ? 'Saving...'
                                    : 'Save'}
                                </Button>
                                <Button
                                  plain
                                  onClick={handleCancel}
                                  disabled={updateActivityMutation.isPending}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                              {activity.content}
                            </div>
                          )}
                        </>
                      )}

                    {activity.activityType !== 'comment' && (
                      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {activity.activityType}
                      </div>
                    )}
                  </div>

                  {/* Edit button - only show for own comments when not editing */}
                  {activity.activityType === 'comment' &&
                    currentUserId &&
                    activity.actorId === currentUserId &&
                    editingActivityId !== activity.id && (
                      <button
                        onClick={() =>
                          handleEdit(activity.id, activity.content || '')
                        }
                        disabled={updateActivityMutation.isPending}
                        className="text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit comment"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment Input Form */}
      {currentUserId && (
        <>
          <Divider />
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!comment.trim() || createCommentMutation.isPending}
              >
                {createCommentMutation.isPending
                  ? 'Posting...'
                  : 'Post Comment'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
