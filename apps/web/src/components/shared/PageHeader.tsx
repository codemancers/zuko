import { Heading, Divider } from '@zuko/ui-kit';

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <>
      <div className="flex flex-col">
        <Heading>{title}</Heading>
        {description && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      <Divider className="mt-6" />
    </>
  );
}
