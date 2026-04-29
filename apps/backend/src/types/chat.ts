export interface ContextEntityReference {
  type: 'contact' | 'company' | 'deal';
  id: number;
}

/**
 * message metadata
 */
export interface MessageMetadata {
  contextEntities?: ContextEntityReference[];
}
