'use client';

import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Download,
  PlayCircle,
  FileText,
  Lightbulb,
  ScrollText,
  CheckCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Badge, Button, Heading, Text, Text as ZukoText } from '@zuko/ui-kit';

dayjs.extend(utc);
dayjs.extend(timezone);

const MEETING_STATUS_COLOR_MAP: Record<string, string> = {
  completed: 'lime',
  failed: 'red',
  in_progress: 'blue',
  processing: 'blue',
};

type Tab = 'recording' | 'transcript' | 'chat' | 'summary' | 'actionItems';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  speech_final: boolean;
  confidence: number;
  timestamp: string;
  speaker: number;
  speaker_name?: string;
  duration_seconds: number;
  formatted_duration: string;
}

interface ChatMessageUser {
  fullName?: string;
  profilePicture?: string;
}

interface ChatMessage {
  user?: ChatMessageUser;
  text?: string | null;
}

interface MeetingSummary {
  id: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  meetingId: number;
  content: string;
}

interface ActionItem {
  description: string | null;
  id: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  meetingId: number;
  taskId: string | null;
  title: string;
}

interface MeetingDetailProps {
  meetingId: string;
  /** Optional override for testing (e.g. empty states, IN_PROGRESS) */
  meetingOverride?: Partial<{
    status: string;
    recordingUrl: string | null;
    transcript: TranscriptData[];
    chatMessages: ChatMessage[];
    summary: MeetingSummary | null;
    actionItems: ActionItem[];
  }>;
}

const MeetingDetail = ({ meetingId, meetingOverride }: MeetingDetailProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('recording');
  const [actionItemSearch, setActionItemSearch] = useState('');
  const [supportsPiP, setSupportsPiP] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  // Dummy Data
  // TODO: Remove this and use the actual data from the API
  const defaultMeeting = {
    id: meetingId,
    name: 'Weekly Sync - Product & Engineering',
    status: 'COMPLETED',
    platform: 'ZOOM',
    scheduledAt: dayjs().toISOString(),
    createdAt: dayjs().subtract(1, 'hour').toISOString(),
    timezone: 'UTC',
    recordingUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    description:
      'Weekly sync to discuss progress, blockers, and upcoming features.',
    projects: [{ id: 1, name: 'Zuko AI' }],
    transcript: [
      {
        text: 'Hello everyone, let’s start the sync.',
        speaker_name: 'Alice',
        formatted_duration: '00:00:05',
        is_final: true,
        speech_final: true,
        confidence: 0.99,
        timestamp: '5000',
        speaker: 1,
        duration_seconds: 5,
      },
      {
        text: 'I have some updates on the UI refactor.',
        speaker_name: 'Bob',
        formatted_duration: '00:00:12',
        is_final: true,
        speech_final: true,
        confidence: 0.98,
        timestamp: '12000',
        speaker: 2,
        duration_seconds: 7,
      },
    ],
    chatMessages: [
      {
        user: {
          fullName: 'Alice',
          profilePicture: 'https://avatar.vercel.sh/alice',
        },
        text: 'Starting now!',
      },
      {
        user: {
          fullName: 'Bob',
          profilePicture: 'https://avatar.vercel.sh/bob',
        },
        text: 'I will be 2 mins late.',
      },
    ],
    summary: {
      id: 1,
      meetingId: Number(meetingId),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
      content:
        'The team discussed the ongoing UI refactor. Bob mentioned that the core components are ready. Alice will review the implementation plan by EOD tomorrow.',
    },
    actionItems: [
      {
        id: 1,
        title: 'Review UI refactor components',
        description: 'Alice to review Bob’s PR by tomorrow.',
        taskId: null,
        meetingId: Number(meetingId),
        createdAt: dayjs().toISOString(),
        updatedAt: dayjs().toISOString(),
      },
      {
        id: 2,
        title: 'Setup Asana integration',
        description: 'Bob to check the API documentation.',
        taskId: 'asana-task-1',
        meetingId: Number(meetingId),
        createdAt: dayjs().toISOString(),
        updatedAt: dayjs().toISOString(),
      },
    ],
  };
  const meeting = meetingOverride
    ? { ...defaultMeeting, ...meetingOverride }
    : defaultMeeting;

  const isAsanaIntegrationEnabled = true;
  const isAsanaConnected = true;
  const projectId = meeting.projects[0].id;

  const onEndMeeting = (id: string) => {
    toast.success('Meeting ended: ' + id);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;

    setSupportsPiP(
      'pictureInPictureEnabled' in document && document.pictureInPictureEnabled,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => undefined);
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  const handlePiPForTabChange = async (nextTab: Tab) => {
    if (!supportsPiP || typeof document === 'undefined') return;

    if (
      !document.pictureInPictureElement &&
      !videoRef.current?.requestPictureInPicture
    ) {
      return;
    }

    // Leaving recording -> try to enter PiP
    if (
      activeTab === 'recording' &&
      nextTab !== 'recording' &&
      videoRef.current &&
      !document.pictureInPictureElement
    ) {
      try {
        await videoRef.current.requestPictureInPicture();
      } catch (error) {
        console.error('Picture-in-Picture enter error:', error);
      }
    }

    // Returning to recording -> exit PiP if active
    if (
      activeTab !== 'recording' &&
      nextTab === 'recording' &&
      document.pictureInPictureElement
    ) {
      try {
        await document.exitPictureInPicture();
      } catch (error) {
        console.error('Picture-in-Picture exit error:', error);
      }
    }
  };

  const handleTabChange = async (tab: Tab) => {
    await handlePiPForTabChange(tab);
    setActiveTab(tab);
  };

  const renderRecordingPanel = () => {
    if (meeting) {
      if (!meeting.recordingUrl) {
        return (
          <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
            <Text>No recording available for this meeting</Text>
          </div>
        );
      }
      return (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <a
              href={meeting.recordingUrl}
              download={`${meeting.name}.mp4`}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <Download className="size-4" />
              Download
            </a>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              src={meeting.recordingUrl}
              controls
              preload="auto"
              className="h-full w-full"
            />
          </div>
        </div>
      );
    }
    return null;
  };

  const renderTabContent = () => {
    if (meeting) {
      switch (activeTab) {
        case 'transcript': {
          if (!meeting.transcript || meeting.transcript.length === 0) {
            return (
              <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
                <ZukoText>No transcript available for this meeting</ZukoText>
              </div>
            );
          }

          const vtt = ['WEBVTT\n'];

          meeting.transcript.forEach((line: TranscriptData) => {
            const message = line.text;
            const speaker = line.speaker_name;
            const timestamp = line.formatted_duration;

            if (!message) return;
            vtt.push(`${timestamp} ${speaker}: ${message}`);
            vtt.push('');
          });

          return (
            <ZukoText className="overflow-x-auto p-4 font-mono whitespace-pre-wrap">
              {vtt.join('\n')}
            </ZukoText>
          );
        }
        case 'chat': {
          const messages: ChatMessage[] = meeting.chatMessages || [];
          if (!messages || messages.length === 0) {
            return (
              <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
                <ZukoText>No chat messages available for this meeting</ZukoText>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  {m.user?.profilePicture && (
                    <Image
                      src={m.user.profilePicture}
                      alt={m.user?.fullName || 'User'}
                      className="h-8 w-8 rounded-full"
                      width={32}
                      height={32}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {m.user?.fullName || 'Unknown'}
                    </div>
                    <div className="text-sm break-words text-zinc-700 dark:text-zinc-300">
                      {m.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        }
        case 'summary': {
          const summary: MeetingSummary | null | undefined = meeting.summary;
          if (!summary || !summary.content) {
            return (
              <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
                <ZukoText>No summary available for this meeting</ZukoText>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="prose dark:prose-invert max-w-none">
                  {summary.content}
                </div>
              </div>
            </div>
          );
        }

        case 'actionItems': {
          const items: ActionItem[] = meeting.actionItems || [];
          if (!items || items.length === 0) {
            return (
              <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
                <ZukoText>No action items for this meeting</ZukoText>
              </div>
            );
          }

          const filtered = items.filter((it) => {
            if (!actionItemSearch.trim()) return true;
            const q = actionItemSearch.toLowerCase();
            return (
              it.title.toLowerCase().includes(q) ||
              (it.description?.toLowerCase().includes(q) ?? false)
            );
          });

          const copyText = (txt: string) => {
            toast.success('Copied to clipboard');
            window?.navigator?.clipboard?.writeText(txt).catch(() => undefined);
          };

          return (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {filtered.length} of {items.length} items
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <input
                    value={actionItemSearch}
                    onChange={(e) => setActionItemSearch(e.target.value)}
                    placeholder="Search action items…"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm ring-0 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {filtered.length === 0 && actionItemSearch.trim() ? (
                <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <ZukoText className="text-zinc-500 dark:text-zinc-400">
                    No results found
                  </ZukoText>
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filtered.map((it) => {
                    const hasTask = !!it.taskId;

                    return (
                      <li
                        key={it.id}
                        className={[
                          'group rounded-xl border p-4 transition',
                          hasTask
                            ? 'opacity-75 border-zinc-200/50 bg-zinc-50/50 dark:border-zinc-800/50 dark:bg-zinc-900/50'
                            : 'border-zinc-200 bg-white hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
                        ].join(' ')}
                      >
                        <div className="flex flex-col gap-3">
                          <div className="min-w-0">
                            <div className="min-w-0 flex-1">
                              <ZukoText
                                className={[
                                  'text-base md:text-lg font-semibold md:font-bold tracking-tight',
                                  hasTask
                                    ? 'text-zinc-400 dark:text-zinc-600'
                                    : 'text-zinc-950 dark:text-zinc-50',
                                ].join(' ')}
                              >
                                {it.title}
                              </ZukoText>

                              {it.description && (
                                <div
                                  className={[
                                    'mt-1.5 text-sm leading-relaxed',
                                    hasTask
                                      ? 'text-zinc-400 dark:text-zinc-600'
                                      : 'text-zinc-700 dark:text-zinc-300',
                                  ].join(' ')}
                                >
                                  {it.description}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            {isAsanaIntegrationEnabled && projectId && (
                              <button
                                onClick={() => handleAddToAsana(it)}
                                className={[
                                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
                                  hasTask
                                    ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20'
                                    : 'border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-500/10',
                                ].join(' ')}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {isAsanaConnected
                                  ? hasTask
                                    ? 'Open in Asana'
                                    : 'Add to Asana'
                                  : 'Connect'}
                              </button>
                            )}

                            <button
                              onClick={() =>
                                copyText(
                                  `${it.title}${
                                    it.description ? ` — ${it.description}` : ''
                                  }`,
                                )
                              }
                              className={
                                'inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 text-xs text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                              }
                              aria-label="Copy action item"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        }
      }
    }
    return null;
  };

  const handleAddToAsana = (actionItem: ActionItem) => {
    if (isAsanaConnected) {
      if (actionItem.taskId) {
        const url = `https://app.asana.com/0/${projectId}/${actionItem.taskId}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    } else {
      router.push('/settings');
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <span>&lt;&nbsp;&nbsp;Meetings</span>
      </button>

      {/* Loading Meeting Details */}

      {/* Failed To Load The Meeting Details */}

      {/* Meeting Details */}
      {meeting && (
        <>
          <div className="flex items-center justify-between">
            <Heading>{meeting.name}</Heading>
            {meeting.status === 'IN_PROGRESS' && (
              <Button
                color="red"
                onClick={() => {
                  onEndMeeting(meetingId);
                }}
              >
                End Meeting
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <ZukoText className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Platform
              </ZukoText>
              <ZukoText className="mt-1">
                {meeting.platform.replace(/_/g, ' ')}
              </ZukoText>
            </div>

            <div>
              <ZukoText className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Status
              </ZukoText>
              <div className="mt-1">
                <Badge
                  color={
                    MEETING_STATUS_COLOR_MAP[meeting.status.toLowerCase()] ??
                    'zinc'
                  }
                >
                  {meeting.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>

            <div>
              <ZukoText className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {meeting.scheduledAt ? 'Scheduled At' : 'Created At'}
              </ZukoText>
              <ZukoText className="mt-1">
                {meeting.scheduledAt
                  ? dayjs(meeting.scheduledAt)
                      .tz(meeting.timezone)
                      .format('MMM D, YYYY [at] h:mm A')
                  : dayjs(meeting.createdAt).format('MMM D, YYYY [at] h:mm A')}
              </ZukoText>
            </div>

            {meeting.projects && meeting.projects.length > 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <ZukoText className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Projects
                </ZukoText>
                <ZukoText className="mt-1">
                  {meeting.projects
                    .map((project: { name: string }) => project.name)
                    .join(', ')}
                </ZukoText>
              </div>
            )}

            {meeting.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <ZukoText className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Description
                </ZukoText>
                <ZukoText className="mt-1">{meeting.description}</ZukoText>
              </div>
            )}
          </div>

          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="-mb-px flex space-x-4 overflow-x-auto md:space-x-8">
              <button
                onClick={() => handleTabChange('recording')}
                className={`flex shrink-0 items-center space-x-1.5 border-b-2 px-2 py-3 text-xs font-medium md:space-x-2 md:px-1 md:py-4 md:text-sm ${
                  activeTab === 'recording'
                    ? 'border-zinc-500 text-zinc-900 dark:border-zinc-400 dark:text-white'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <PlayCircle className="h-4 w-4 md:h-5 md:w-5" />
                <span>Recording</span>
              </button>
              <button
                onClick={() => handleTabChange('transcript')}
                className={`flex shrink-0 items-center space-x-1.5 border-b-2 px-2 py-3 text-xs font-medium md:space-x-2 md:px-1 md:py-4 md:text-sm ${
                  activeTab === 'transcript'
                    ? 'border-zinc-500 text-zinc-900 dark:border-zinc-400 dark:text-white'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                <span>Transcript</span>
              </button>
              <button
                onClick={() => handleTabChange('chat')}
                className={`flex shrink-0 items-center space-x-1.5 border-b-2 px-2 py-3 text-xs font-medium md:space-x-2 md:px-1 md:py-4 md:text-sm ${
                  activeTab === 'chat'
                    ? 'border-zinc-500 text-zinc-900 dark:border-zinc-400 dark:text-white'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Lightbulb className="h-4 w-4 md:h-5 md:w-5" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => handleTabChange('summary')}
                className={`flex shrink-0 items-center space-x-1.5 border-b-2 px-2 py-3 text-xs font-medium md:space-x-2 md:px-1 md:py-4 md:text-sm ${
                  activeTab === 'summary'
                    ? 'border-zinc-500 text-zinc-900 dark:border-zinc-400 dark:text-white'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <ScrollText className="h-4 w-4 md:h-5 md:w-5" />
                <span>Summary</span>
              </button>
              <button
                onClick={() => handleTabChange('actionItems')}
                className={`flex shrink-0 items-center space-x-1.5 border-b-2 px-2 py-3 text-xs font-medium md:space-x-2 md:px-1 md:py-4 md:text-sm ${
                  activeTab === 'actionItems'
                    ? 'border-zinc-500 text-zinc-900 dark:border-zinc-400 dark:text-white'
                    : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5" />
                <span>Action Items</span>
              </button>
            </nav>
          </div>

          <div className="mt-6 space-y-6">
            <div className={activeTab === 'recording' ? 'block' : 'hidden'}>
              {renderRecordingPanel()}
            </div>
            {activeTab !== 'recording' && renderTabContent()}
          </div>
        </>
      )}
    </div>
  );
};

export default MeetingDetail;
