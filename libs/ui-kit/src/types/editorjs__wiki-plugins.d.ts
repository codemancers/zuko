declare module '@editorjs/table' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const Table: BlockToolConstructable;
  export default Table;
}

declare module '@editorjs/warning' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const Warning: BlockToolConstructable;
  export default Warning;
}

declare module '@editorjs/embed' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const Embed: BlockToolConstructable;
  export default Embed;
}
