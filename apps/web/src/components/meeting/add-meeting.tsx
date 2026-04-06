'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  Divider,
  Heading,
  Field,
  Label,
  Input,
  Combobox,
  ComboboxLabel,
  ComboboxOption,
  Button,
  Text,
  Switch,
} from '@zuko/ui-kit';
import z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { meetingsApi } from '@/lib/api/meetings';
import { toast } from 'sonner';

dayjs.extend(utc);
dayjs.extend(timezone);

export const MeetingFormSchema = z.object({
  url: z
    .string()
    .min(1, 'Meeting URL is required')
    .refine((url) => {
      return url.startsWith('https://');
    }, 'Please enter a valid URL'),
  name: z.string().min(1, 'Meeting name is required'),
  description: z.string().optional(),
  scheduledAt: z.string().optional(),
  timezone: z.string().optional(),
});

export type MeetingFormSchemaType = z.infer<typeof MeetingFormSchema>;

const AddMeeting = () => {
  const timezones = [
    { tzCode: 'Asia/Kolkata' },
    { tzCode: 'UTC' },
    { tzCode: 'America/New_York' },
  ];

  const defaultTimezone = 'Asia/Kolkata';
  const router = useRouter();
  const [isJoinNow, setIsJoinNow] = useState(false);

  const createMutation = useMutation({
    mutationFn: meetingsApi.createMeeting,
    onSuccess: (response) => {
      toast.success('Meeting created successfully');
      router.push(`/meeting/${response.meeting.id}`);
    },
    onError: () => toast.error('Failed to create meeting'),
  });

  const {
    handleSubmit,
    register,
    formState: { errors },
    setValue,
  } = useForm<MeetingFormSchemaType>({
    resolver: zodResolver(MeetingFormSchema),
    defaultValues: {
      timezone: defaultTimezone,
    },
  });

  const onMeetingFormSubmit: SubmitHandler<MeetingFormSchemaType> = (
    formData,
  ) => {
    const scheduledDate =
      !isJoinNow && formData.scheduledAt
        ? dayjs(formData.scheduledAt).tz(formData.timezone).utc().toDate().toISOString()
        : undefined;

    createMutation.mutate({
      url: formData.url,
      name: formData.name,
      description: formData.description,
      ...(scheduledDate
        ? { scheduledAt: scheduledDate, timezone: formData.timezone }
        : {}),
    });
  };

  const handleCancel = () => {
    router.replace('/meetings');
  };

  return (
    <div>
      <main>
        <div className="m-8 flex flex-col">
          <Heading>Add Meeting</Heading>
          <Divider className="my-8" />

          <form
            className="flex flex-col gap-6 rounded-lg lg:p-0"
            onSubmit={handleSubmit(onMeetingFormSubmit)}
          >
            <section className="flex w-full flex-col items-start justify-between gap-6 lg:flex-row lg:gap-14">
              <section className="flex w-full flex-col gap-2">
                <Field data-error-id="name">
                  <Label>Meeting Name</Label>
                  <Input
                    type="text"
                    id="name"
                    placeholder="Enter meeting name"
                    {...register('name')}
                    autoComplete="off"
                  />
                  {errors.name && (
                    <small className="text-red-400">
                      {errors.name.message}
                    </small>
                  )}
                </Field>
              </section>

              <section className="flex w-full flex-col gap-2">
                <Field data-error-id="url">
                  <Label>Meeting URL</Label>
                  <Input
                    type="text"
                    id="url"
                    placeholder="Paste Meeting URL"
                    {...register('url')}
                    autoComplete="off"
                  />
                  {errors.url && (
                    <small className="text-red-400">{errors.url.message}</small>
                  )}
                </Field>
              </section>
            </section>

            <section className="flex w-full flex-col gap-2">
              <Field>
                <Label htmlFor="description">Meeting Description</Label>
                <textarea
                  id="description"
                  placeholder="Meeting description"
                  {...register('description')}
                  autoComplete="off"
                  className="min-h-[100px] w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-3 py-2 text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none data-hover:border-zinc-950/20 sm:text-sm/6 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-400 dark:data-hover:border-white/20"
                />
              </Field>
            </section>

            <section className="mb-4 flex items-center gap-2">
              <Switch
                checked={isJoinNow}
                onChange={setIsJoinNow}
                color="blue"
              />
              <Text>Join Now</Text>
            </section>

            {!isJoinNow && (
              <section className="flex w-full flex-col items-start justify-between gap-6 lg:flex-row lg:gap-14">
                <section className="flex w-full flex-col gap-2">
                  <Field data-error-id="scheduledAt">
                    <Label>Schedule Time</Label>
                    <Input
                      type="datetime-local"
                      id="scheduledAt"
                      {...register('scheduledAt')}
                    />
                    {errors.scheduledAt && (
                      <small className="text-red-400">
                        {errors.scheduledAt.message}
                      </small>
                    )}
                  </Field>
                </section>

                <section
                  className="flex w-full flex-col gap-2"
                  data-testid="timezone-field"
                >
                  <Field data-error-id="timezone">
                    <Label>Timezone</Label>
                    <Combobox
                      name="timezone"
                      options={timezones}
                      displayValue={(tz: any) => tz?.tzCode}
                      defaultValue={timezones.find(
                        (tz) => tz.tzCode === defaultTimezone,
                      )}
                      onChange={(tz: any) => {
                        setValue('timezone', tz?.tzCode || defaultTimezone);
                      }}
                    >
                      {(tz: any) => (
                        <ComboboxOption value={tz}>
                          <ComboboxLabel>{tz.tzCode}</ComboboxLabel>
                        </ComboboxOption>
                      )}
                    </Combobox>
                  </Field>
                </section>
              </section>
            )}

            <section className="flex items-center justify-end gap-6">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
              <Button
                type="button"
                onClick={handleCancel}
                color="white"
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
            </section>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AddMeeting;
