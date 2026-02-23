"use client";

import { ProgressProvider } from '@bprogress/next/app';

const customStyles = `
:root {
  --bprogress-color: #71717a;
  --bprogress-height: 2px;
  --bprogress-spinner-size: 18px;
  --bprogress-spinner-animation-duration: 400ms;
  --bprogress-spinner-border-size: 2px;
  --bprogress-box-shadow: 0 0 10px #71717a, 0 0 5px #71717a;
  --bprogress-z-index: 99999;
  --bprogress-spinner-top: 15px;
  --bprogress-spinner-bottom: auto;
  --bprogress-spinner-right: 15px;
  --bprogress-spinner-left: auto;
}

.bprogress {
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: var(--bprogress-z-index);
}

.bprogress .bar {
  background: var(--bprogress-color);
  position: fixed;
  z-index: var(--bprogress-z-index);
  top: 0;
  left: 0;
  width: 100%;
  height: var(--bprogress-height);
}

.bprogress .peg {
  display: block;
  position: absolute;
  right: 0;
  width: 100px;
  height: 100%;
  box-shadow: var(--bprogress-box-shadow);
  opacity: 1.0;
  transform: rotate(3deg) translate(0px, -4px);
}

/* Hide spinner */
.bprogress .spinner {
  display: none !important;
}

.bprogress-custom-parent {
  overflow: hidden;
  position: relative;
}

.bprogress-custom-parent .bprogress .spinner,
.bprogress-custom-parent .bprogress .bar {
  position: absolute;
}

@-webkit-keyframes bprogress-spinner {
  0%   { -webkit-transform: rotate(0deg); transform: rotate(0deg); }
  100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); }
}

@keyframes bprogress-spinner {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

export function ProgressBar({ children }: { children: React.ReactNode }) {
  return (
    <ProgressProvider disableStyle={false} style={customStyles}>
      {children}
    </ProgressProvider>
  );
}
