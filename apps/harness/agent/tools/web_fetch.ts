import { disableTool } from 'eve/tools';

// Runs in the harness process, outside the sandbox, so the sandbox's network policy would not cover it.
export default disableTool();
