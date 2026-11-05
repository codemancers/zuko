'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { authClient } from '@/lib/auth-client';
import TaskForm from './TaskForm';
import type { TaskPerson } from './TaskPersonField';

export function SalesTaskCreateButton({ person }: { person?: TaskPerson }) {
  const organization = authClient.useActiveOrganization();
  const session = authClient.useSession();
  const userId = Number(session.data?.user.id);
  if (!organization.data?.id || !Number.isSafeInteger(userId) || userId <= 0)
    return null;
  // A context switch discards the old organization's form rather than saving it elsewhere.
  return (
    <SalesTaskCreateControl
      key={`${organization.data.id}:${userId}:${person?.type ?? ''}:${person?.id ?? ''}`}
      userId={userId}
      person={person}
    />
  );
}

function SalesTaskCreateControl({
  userId,
  person,
}: {
  userId: number;
  person?: TaskPerson;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const close = () => {
    if (!saving) setOpen(false);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add task</Button>
      <Sheet open={open} onClose={close} side="right">
        <SheetHeader>
          <SheetTitle>New Task</SheetTitle>
          <Button
            plain
            aria-label="Close task panel"
            onClick={close}
            disabled={saving}
          >
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        {open && (
          <TaskForm
            mode="create"
            defaultIsSales
            defaultDueDate={dayjs().format('YYYY-MM-DD')}
            defaultAssigneeUserId={userId}
            defaultPerson={person}
            onSavingChange={setSaving}
            onCancel={close}
            onSuccess={() => setOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
}
