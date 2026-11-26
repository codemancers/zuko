import { defineSandbox } from 'eve/sandbox';
import { DockerSandbox } from 'eve/sandbox/docker';

// Always a Docker container, never the automatic fallback to just-bash (which has no process
// isolation). Eve owns one container per session and resumes it across turns.
export const environment = DockerSandbox.dockerfile();

// No network: injected commands cannot send file contents out. Files enter the sandbox only
// through eve's attachment staging and leave only through Zuko's own file tools.
export default defineSandbox(() => environment.open({ networkPolicy: 'deny-all' }));
