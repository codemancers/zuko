import { Boxes, Building2, Contact, Handshake, type LucideIcon } from 'lucide-react';

export const OBJECT_ICONS: Record<string, LucideIcon> = {
  contact: Contact,
  company: Building2,
  deal: Handshake,
};

export const getObjectIcon = (name: string): LucideIcon => OBJECT_ICONS[name] ?? Boxes;
