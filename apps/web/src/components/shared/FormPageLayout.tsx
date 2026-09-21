import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

interface FormPageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Scaffold for the create and edit routes. These were eight hand-rolled copies
 * of the same heading/rule/column markup, which is how the measure and the gap
 * above the form drifted apart between entities. One place now decides both:
 * 32px below the rule, and a 2xl column so form labels and inputs keep a
 * readable line length on a wide screen.
 */
export function FormPageLayout({
  title,
  description,
  children,
}: FormPageLayoutProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="mt-8 max-w-2xl">{children}</div>
    </>
  );
}
