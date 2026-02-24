import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  OrchestratorService,
  type GraphStreamRequest,
  GraphStreamMode,
} from '@zuko/agents';

const DEFAULT_STREAM_MODES: GraphStreamMode[] = [
  'updates',
  'messages',
  'custom',
];
const ALLOWED_STREAM_MODES = new Set<GraphStreamMode>(DEFAULT_STREAM_MODES);

const normalizeStreamMode = (
  value: GraphStreamMode | GraphStreamMode[] | undefined
): GraphStreamMode | GraphStreamMode[] => {
  if (!value) {
    return DEFAULT_STREAM_MODES;
  }
  if (Array.isArray(value)) {
    const filtered = value.filter((mode) => ALLOWED_STREAM_MODES.has(mode));
    if (filtered.length === 0) {
      throw new BadRequestException(
        'stream_mode must include updates, messages, or custom'
      );
    }
    return filtered;
  }
  if (!ALLOWED_STREAM_MODES.has(value)) {
    throw new BadRequestException(
      'stream_mode must be updates, messages, or custom'
    );
  }
  return value;
};

@Controller('v1/graph')
export class GraphController {
  private readonly logger = new Logger(GraphController.name);

  constructor(private readonly agentsService: OrchestratorService) {}

  @Post('stream')
  async stream(
    @Body() body: GraphStreamRequest,
    @Res({ passthrough: true }) response?: Response
  ): Promise<void> {
    const input = body?.input;
    if (typeof input === 'undefined') {
      throw new BadRequestException('input is required');
    }

    const streamMode = normalizeStreamMode(body?.stream_mode);

    response?.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response?.setHeader('Cache-Control', 'no-cache');
    response?.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.agentsService.streamGraph(
        input,
        body?.config,
        streamMode
      )) {
        response?.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (error) {
      this.logger.error('LangGraph stream failed', error as Error);
    }

    response?.end();
  }
}
