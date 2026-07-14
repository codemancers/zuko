declare module '@editorjs/header' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const Header: BlockToolConstructable;
  export default Header;
}

declare module '@editorjs/list' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const List: BlockToolConstructable;
  export default List;
}

declare module '@editorjs/code' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const Code: BlockToolConstructable;
  export default Code;
}

declare module '@editorjs/quote' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const Quote: BlockToolConstructable;
  export default Quote;
}

declare module '@editorjs/delimiter' {
  import type { BlockToolConstructable } from '@editorjs/editorjs';
  const Delimiter: BlockToolConstructable;
  export default Delimiter;
}

declare module '@editorjs/inline-code' {
  import type { InlineTool } from '@editorjs/editorjs';
  const InlineCode: InlineTool;
  export default InlineCode;
}

declare module '@editorjs/marker' {
  import type { InlineTool } from '@editorjs/editorjs';
  const Marker: InlineTool;
  export default Marker;
}
