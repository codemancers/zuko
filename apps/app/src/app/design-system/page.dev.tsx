import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Brand } from '../../components/brand';
import { ThemeToggle } from '../../components/theme-toggle';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Design system',
  description: 'Dev-only reference of the Zuko design tokens and components.',
};

const toc = [
  ['colour', 'Colour'],
  ['type', 'Typography'],
  ['shape', 'Shape'],
  ['components', 'Components'],
] as const;

// Each token is rendered with its own utility class, so the swatches always
// reflect the live theme (toggle light/dark in the header).
const colourGroups: { title: string; note: string; tokens: [string, string, string][] }[] = [
  {
    title: 'Surfaces',
    note: 'Page, cards and floating layers.',
    tokens: [
      ['background', 'bg-background border', 'Page'],
      ['card', 'bg-card border', 'Cards'],
      ['popover', 'bg-popover border', 'Menus, popovers'],
      ['muted', 'bg-muted', 'Quiet fills, skeletons'],
      ['secondary', 'bg-secondary', 'Secondary actions'],
      ['accent', 'bg-accent', 'Hover and focus rows'],
    ],
  },
  {
    title: 'Content and actions',
    note: 'Text, the primary action and destructive states.',
    tokens: [
      ['foreground', 'bg-foreground', 'Body text'],
      ['muted-foreground', 'bg-muted-foreground', 'Secondary text'],
      ['primary', 'bg-primary', 'Primary action'],
      ['destructive', 'bg-destructive', 'Errors, delete'],
    ],
  },
  {
    title: 'Lines',
    note: 'Borders, input outlines and the focus ring.',
    tokens: [
      ['border', 'bg-border', 'Hairlines'],
      ['input', 'bg-input', 'Field outlines'],
      ['ring', 'bg-ring', 'Focus ring'],
    ],
  },
  {
    title: 'Charts',
    note: 'Reserved for data visualisation.',
    tokens: [
      ['chart-1', 'bg-chart-1', ''],
      ['chart-2', 'bg-chart-2', ''],
      ['chart-3', 'bg-chart-3', ''],
      ['chart-4', 'bg-chart-4', ''],
      ['chart-5', 'bg-chart-5', ''],
    ],
  },
];

const radii = [
  ['rounded-sm', 'Small'],
  ['rounded-md', 'Medium'],
  ['rounded-lg', 'Large: buttons, inputs'],
  ['rounded-xl', 'XL: cards'],
  ['rounded-2xl', '2XL'],
] as const;

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t py-12" aria-labelledby={`${id}-title`}>
      <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">{title}</h3>
        {note && <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b py-5 last:border-b-0 md:grid-cols-[220px_1fr] md:gap-8">
      <p className="text-muted-foreground font-mono text-xs">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Brand />
            <Badge variant="secondary">Design system</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-24 lg:grid-cols-[160px_1fr]">
        <nav aria-label="On this page" className="hidden pt-12 lg:block">
          <ul className="sticky top-24 flex flex-col gap-2.5 border-l pl-4 text-sm">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-muted-foreground hover:text-foreground transition-colors">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0">
          <div className="pt-12 pb-4">
            <h1 className="text-4xl font-semibold tracking-tight">Zuko design system</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Every token and component the app is built from, rendered live. It is a dev-only page:
              it is not compiled in production builds and returns 404 there. Switch theme in the
              header to check both modes.
            </p>
          </div>

          <Section id="colour" eyebrow="01 · Colour" title="Semantic tokens, themed in light and dark">
            {colourGroups.map((g) => (
              <Block key={g.title} title={g.title} note={g.note}>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {g.tokens.map(([token, cls, use]) => (
                    <li key={token} className="flex flex-col gap-2">
                      <div className={`h-16 rounded-lg ${cls}`} />
                      <p className="font-mono text-xs">{token}</p>
                      {use && <p className="text-muted-foreground text-xs">{use}</p>}
                    </li>
                  ))}
                </ul>
              </Block>
            ))}
          </Section>

          <Section id="type" eyebrow="02 · Typography" title="Geist, one family">
            <div>
              <Specimen label="text-4xl · semibold">
                <p className="text-4xl font-semibold tracking-tight">Welcome back</p>
              </Specimen>
              <Specimen label="text-2xl · semibold">
                <p className="text-2xl font-semibold tracking-tight">Your tasks at a glance</p>
              </Specimen>
              <Specimen label="text-lg · medium">
                <p className="text-lg font-medium">Needs attention</p>
              </Specimen>
              <Specimen label="text-sm · body">
                <p className="max-w-xl text-sm leading-relaxed">
                  Zuko keeps your work in one place so nothing slips between people, tools and days.
                </p>
              </Specimen>
              <Specimen label="text-sm · muted-foreground">
                <p className="text-muted-foreground text-sm">Secondary text, hints and descriptions.</p>
              </Specimen>
              <Specimen label="font-mono text-xs">
                <p className="font-mono text-xs">bg-primary text-primary-foreground</p>
              </Specimen>
            </div>
          </Section>

          <Section id="shape" eyebrow="03 · Shape" title="One radius scale, derived from --radius">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {radii.map(([cls, use]) => (
                <div key={cls} className="flex flex-col gap-2">
                  <div className={`bg-muted h-20 border ${cls}`} />
                  <p className="font-mono text-xs">{cls}</p>
                  <p className="text-muted-foreground text-xs">{use}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="components" eyebrow="04 · Components" title="The parts list">
            <Block title="Buttons" note="Variants and sizes from components/ui/button. One default (primary) action per view.">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs">Extra small</Button>
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
              </div>
            </Block>

            <Block title="Badges">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="ghost">Ghost</Badge>
              </div>
            </Block>

            <Block title="Form fields" note="Field wires label, control, description and error together; errors are text, never colour alone.">
              <FieldGroup className="max-w-md">
                <Field>
                  <FieldLabel htmlFor="ds-name">Name</FieldLabel>
                  <Input id="ds-name" placeholder="Ada Lovelace" />
                  <FieldDescription>As shown to your teammates.</FieldDescription>
                </Field>
                <Field data-invalid>
                  <FieldLabel htmlFor="ds-email">Email</FieldLabel>
                  <Input id="ds-email" defaultValue="ada@" aria-invalid />
                  <FieldError>Please enter a valid email address.</FieldError>
                </Field>
                <Field data-disabled>
                  <FieldLabel htmlFor="ds-off">Disabled</FieldLabel>
                  <Input id="ds-off" disabled defaultValue="Read only" />
                </Field>
              </FieldGroup>
            </Block>

            <Block title="Alerts">
              <div className="grid max-w-xl gap-3">
                <Alert>
                  <AlertTitle>Heads up</AlertTitle>
                  <AlertDescription>A neutral message about something worth knowing.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertTitle>Could not sign in</AlertTitle>
                  <AlertDescription>Invalid email or password.</AlertDescription>
                </Alert>
              </div>
            </Block>

            <Block title="Cards">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>Header, content and footer slots.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Cards hold one idea each.</p>
                  </CardContent>
                  <CardFooter>
                    <Button size="sm">Save</Button>
                  </CardFooter>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Loading</CardTitle>
                    <CardDescription>Skeletons keep the layout stable.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              </div>
            </Block>

            <Block title="Avatar, separator and menu">
              <div className="flex flex-wrap items-center gap-6">
                <Avatar>
                  <AvatarFallback>YU</AvatarFallback>
                </Avatar>
                <Separator orientation="vertical" className="h-8" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Open menu</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>My account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Block>

            <Block title="Brand and theme" note="The Zuko mark follows the theme; the toggle offers Light, Dark and System.">
              <div className="flex flex-wrap items-center gap-6">
                <Brand />
                <ThemeToggle />
              </div>
            </Block>
          </Section>
        </main>
      </div>
    </div>
  );
}
