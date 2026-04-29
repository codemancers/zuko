import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base/base.service';
import type { MeetingSchema } from '../../common/schemas/meeting.schema';

@Injectable()
export class FlyService extends BaseService {
  constructor() {
    super('FlyService');
  }
  async launchFlyWorker(meetingSchema: MeetingSchema): Promise<any> {
    const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
    const APP_NAME = process.env.FLY_APP_NAME;
    const FLY_REGION = process.env.FLY_REGION;
    const imageTag = await this.getLatestImageTag();

    const payload = {
      region: FLY_REGION,
      config: {
        image: imageTag,
        auto_destroy: true,
        env: {
          ...process.env,
          MEETING_ID: String(meetingSchema.meetingId),
          MEETING_URL: meetingSchema.meetingUrl,
          CALLBACK_URL: meetingSchema.callbackUrl,
          NODE_ENV: 'production',
          PLATFORM: 'linux',
        },
        restart: {
          policy: 'no',
        },
        guest: {
          cpu_kind: 'performance',
          cpus: 1,
          memory_mb: 2048,
        },
      },
    };

    const response = await axios.post(
      `https://api.machines.dev/v1/apps/${APP_NAME}/machines`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${FLY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response;
  }

  private async getLatestImageTag(): Promise<string> {
    const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
    const APP_NAME = process.env.FLY_APP_NAME;

    const query = `
  query {
    app(name: "${APP_NAME}") {
      releases(first: 1) {
        nodes {
          version
          createdAt
          imageRef
        }
      }
    }
  }
`;

    const response = await axios.post(
      'https://api.fly.io/graphql',
      { query },
      {
        headers: {
          Authorization: `Bearer ${FLY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const release = response.data.data.app.releases.nodes[0];
    return release.imageRef;
  }
}
