import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ActivityRepository,
  CreateActivityInput,
  ActivityFilters,
  ActivityPaginationOptions,
} from '../repositories/activity.repository';

@Injectable()
export class ActivityService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async create(input: CreateActivityInput) {
    // Validate required fields
    if (!input.activityType) {
      throw new BadRequestException('Activity type is required');
    }
    if (!input.entityType) {
      throw new BadRequestException('Entity type is required');
    }
    if (!input.entityId) {
      throw new BadRequestException('Entity ID is required');
    }

    // For comments, content is required
    if (input.activityType === 'comment' && !input.content) {
      throw new BadRequestException('Comment content is required');
    }

    return this.activityRepository.create(input);
  }

  async findById(id: number) {
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }
    return activity;
  }

  async findAll(
    filters?: ActivityFilters,
    pagination?: ActivityPaginationOptions,
  ) {
    return this.activityRepository.findAll(filters, pagination);
  }

  async getTimeline(entityType: string, entityId: number, limit?: number) {
    return this.activityRepository.getTimeline(entityType, entityId, limit);
  }

  async createComment(
    entityType: string,
    entityId: number,
    actorId: number,
    content: string,
  ) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    return this.activityRepository.createComment(
      entityType,
      entityId,
      actorId,
      content.trim(),
    );
  }

  async delete(id: number, userId: number) {
    // Find the activity first
    const activity = await this.findById(id);

    // Only the author can delete their own activity
    if (activity.actorId !== userId) {
      throw new ForbiddenException('You can only delete your own activities');
    }

    return this.activityRepository.delete(id);
  }

  async update(id: number, userId: number, content: string) {
    // Validate content
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Comment content cannot be empty');
    }

    // Find the activity first
    const activity = await this.findById(id);

    // Only the author can edit their own activity
    if (activity.actorId !== userId) {
      throw new ForbiddenException('You can only edit your own activities');
    }

    // Only comments can be edited
    if (activity.activityType !== 'comment') {
      throw new BadRequestException('Only comments can be edited');
    }

    return this.activityRepository.update(id, content.trim());
  }
}
