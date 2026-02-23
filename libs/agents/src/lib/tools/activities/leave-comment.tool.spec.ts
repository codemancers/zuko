import { createLeaveCommentTool } from './leave-comment.tool';
import type { ActivityService } from '@zuko/sales';

describe('createLeaveCommentTool', () => {
  let mockActivityService: jest.Mocked<ActivityService>;
  let tool: ReturnType<typeof createLeaveCommentTool>;

  beforeEach(() => {
    mockActivityService = {
      createComment: jest.fn(),
    } as any;

    tool = createLeaveCommentTool(mockActivityService);
  });

  it('should call activityService.createComment with userId from parameters', async () => {
    const mockActivity = {
      id: 123,
      createdAt: new Date('2026-02-11'),
    };

    mockActivityService.createComment.mockResolvedValue(mockActivity as any);

    const result = await tool.invoke({
      entityType: 'contact',
      entityId: 456,
      content: 'Test comment',
      userId: 789,
    });

    expect(mockActivityService.createComment).toHaveBeenCalledWith(
      'contact',
      456,
      789, // userId should be passed through
      'Test comment'
    );

    expect(result).toEqual({
      success: true,
      activityId: 123,
      message: 'Comment added successfully to contact 456',
      content: 'Test comment',
      createdAt: '2026-02-11T00:00:00.000Z',
    });
  });

  it('should handle errors gracefully', async () => {
    mockActivityService.createComment.mockRejectedValue(
      new Error('Database error')
    );

    const result = await tool.invoke({
      entityType: 'account',
      entityId: 123,
      content: 'Test comment',
      userId: 456,
    });

    expect(result).toEqual({
      success: false,
      error: 'Database error',
    });
  });

  it('should work with different entity types', async () => {
    const mockActivity = {
      id: 999,
      createdAt: new Date('2026-02-11'),
    };

    mockActivityService.createComment.mockResolvedValue(mockActivity as any);

    // Test with deal
    await tool.invoke({
      entityType: 'deal',
      entityId: 111,
      content: 'Deal comment',
      userId: 222,
    });

    expect(mockActivityService.createComment).toHaveBeenCalledWith(
      'deal',
      111,
      222,
      'Deal comment'
    );
  });

  it('should have correct tool metadata', () => {
    expect(tool.name).toBe('leave_comment');
    expect(tool.description).toContain('Leave a comment');
    expect(tool.description).toContain('userId');
  });
});
