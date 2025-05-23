import { Inject, Injectable } from '@nestjs/common';
import { DependencyInjection } from '../../../../../common/common-domain/DependencyInjection';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import DynamoDBConfig from '../../../../../config/DynamoDBConfig';
import AttachmentEntity from '../entity/AttachmentEntity';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import DynamoDBBuilder from '../../../../../common/common-data-access/UpdateBuilder';
import strictPlainToClass from '../../../../../common/common-domain/mapper/strictPlainToClass';
import AttachmentKey from '../entity/AttachmentKey';
import LessonKey from '../../../../lesson/data-access/database/entity/LessonKey';
import CourseKey from '../../../../course/data-access/database/entity/CourseKey';
import Pagination from '../../../../../common/common-domain/repository/Pagination';
import LessonNotFoundException from '../../../../lesson/domain/domain-core/exception/LessonNotFoundException';
import { DynamoDBExceptionCode } from '../../../../../common/common-domain/DynamoDBExceptionCode';
import CourseNotFoundException from '../../../../course/domain/domain-core/exception/CourseNotFoundException';
import InternalServerException from '../../../../../common/common-domain/exception/InternalServerException';
import DuplicateKeyException from '../../../../../common/common-domain/exception/DuplicateKeyException';
import AttachmentNotFoundException from '../../../domain/domain-core/exception/AttachmentNotFoundException';

@Injectable()
export default class AttachmentDynamoDBRepository {
  constructor(
    @Inject(DependencyInjection.DYNAMODB_DOCUMENT_CLIENT)
    private readonly dynamoDBDocumentClient: DynamoDBDocumentClient,
    private readonly dynamoDBConfig: DynamoDBConfig,
  ) {}

  public async saveIfNotExistsOrThrow(param: {
    attachmentEntity: AttachmentEntity;
  }): Promise<void> {
    const { attachmentEntity } = param;
    try {
      const { courseId, lessonId } = attachmentEntity;
      await this.dynamoDBDocumentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.dynamoDBConfig.ATTACHMENT_TABLE,
                Item: attachmentEntity,
                ConditionExpression:
                  'attribute_not_exists(lessonId) AND attribute_not_exists(attachmentId)',
              },
            },
            {
              Update: {
                TableName: this.dynamoDBConfig.LESSON_TABLE,
                Key: new LessonKey({ courseId, lessonId }),
                ConditionExpression:
                  'attribute_exists(courseId) AND attribute_exists(lessonId)',
                UpdateExpression: 'ADD #numberOfAttachments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAttachments': 'numberOfAttachments',
                },
                ExpressionAttributeValues: {
                  ':value0': 1,
                },
              },
            },
            {
              Update: {
                TableName: this.dynamoDBConfig.COURSE_TABLE,
                Key: new CourseKey({ courseId }),
                ConditionExpression:
                  'attribute_exists(id) AND attribute_exists(courseId)',
                UpdateExpression: 'ADD #numberOfAttachments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAttachments': 'numberOfAttachments',
                },
                ExpressionAttributeValues: {
                  ':value0': 1,
                },
              },
            },
          ],
        }),
      );
    } catch (exception) {
      if (exception instanceof TransactionCanceledException) {
        const { CancellationReasons } = exception;
        if (!CancellationReasons) throw new InternalServerException();
        if (
          CancellationReasons[0].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw new DuplicateKeyException({ throwable: exception });
        if (
          CancellationReasons[1].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw new LessonNotFoundException({ throwable: exception });
        if (
          CancellationReasons[2].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw new CourseNotFoundException({ throwable: exception });
      }
      throw new InternalServerException({ throwable: exception });
    }
  }

  public async findMany(param: {
    lessonId: number;
    pagination: Pagination;
  }): Promise<AttachmentEntity[]> {
    const { lessonId, pagination } = param;
    const attachmentEntities: AttachmentEntity[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    let limit: number | undefined = pagination.limit;
    do {
      if (limit === 0) break;
      const { Items, LastEvaluatedKey } =
        await this.dynamoDBDocumentClient.send(
          new QueryCommand({
            TableName: this.dynamoDBConfig.ATTACHMENT_TABLE,
            KeyConditionExpression: pagination.lastEvaluatedId
              ? '#lessonId = :value0 AND attachmentId < :value1'
              : '#lessonId = :value0',
            ExpressionAttributeNames: {
              '#lessonId': 'lessonId',
            },
            ExpressionAttributeValues: {
              ':value0': lessonId,
              ...(pagination.lastEvaluatedId
                ? { ':value1': pagination.lastEvaluatedId }
                : {}),
            },
            ExclusiveStartKey: lastEvaluatedKey,
            Limit: limit,
          }),
        );
      if (Items) {
        attachmentEntities.push(
          ...Items.map((item) => strictPlainToClass(AttachmentEntity, item)),
        );
      }
      lastEvaluatedKey = LastEvaluatedKey as Record<string, any> | undefined;
      if (limit) {
        limit = pagination.limit - attachmentEntities.length;
      }
    } while (lastEvaluatedKey);
    return attachmentEntities;
  }

  public async findByIdOrThrow(param: {
    lessonId: number;
    attachmentId: number;
  }): Promise<AttachmentEntity> {
    const { lessonId, attachmentId } = param;
    const response = await this.dynamoDBDocumentClient.send(
      new GetCommand({
        TableName: this.dynamoDBConfig.ATTACHMENT_TABLE,
        Key: new AttachmentKey({ lessonId, attachmentId }),
      }),
    );
    if (!response.Item) {
      throw new AttachmentNotFoundException();
    }
    return strictPlainToClass(AttachmentEntity, response.Item);
  }

  public async saveIfExistsOrThrow(param: {
    attachmentEntity: AttachmentEntity;
  }): Promise<void> {
    const { attachmentEntity } = param;
    try {
      const { attachmentId, lessonId, ...restObj } = attachmentEntity;
      const updateObj = DynamoDBBuilder.buildUpdate(restObj);
      if (!updateObj) return;
      await this.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: this.dynamoDBConfig.ATTACHMENT_TABLE,
          Key: new AttachmentKey({ lessonId, attachmentId }),
          ConditionExpression:
            'attribute_exists(lessonId) AND attribute_exists(attachmentId)',
          ...updateObj,
        }),
      );
    } catch (exception) {
      if (exception instanceof ConditionalCheckFailedException)
        throw new AttachmentNotFoundException({ throwable: exception });
      throw new InternalServerException({ throwable: exception });
    }
  }

  public async deleteIfExistsOrThrow(param: {
    courseId: number;
    lessonId: number;
    attachmentId: number;
  }): Promise<void> {
    const { courseId, lessonId, attachmentId } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.dynamoDBConfig.ATTACHMENT_TABLE,
                Key: new AttachmentKey({ lessonId, attachmentId }),
                ConditionExpression:
                  'attribute_exists(lessonId) AND attribute_exists(attachmentId)',
              },
            },
            {
              Update: {
                TableName: this.dynamoDBConfig.LESSON_TABLE,
                Key: new LessonKey({ courseId, lessonId }),
                ConditionExpression:
                  'attribute_exists(courseId) AND attribute_exists(lessonId)',
                UpdateExpression: 'ADD #numberOfAttachments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAttachments': 'numberOfAttachments',
                },
                ExpressionAttributeValues: {
                  ':value0': -1,
                },
              },
            },
            {
              Update: {
                TableName: this.dynamoDBConfig.COURSE_TABLE,
                Key: new CourseKey({ courseId }),
                ConditionExpression:
                  'attribute_exists(id) AND attribute_exists(courseId)',
                UpdateExpression: 'ADD #numberOfAttachments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAttachments': 'numberOfAttachments',
                },
                ExpressionAttributeValues: {
                  ':value0': -1,
                },
              },
            },
          ],
        }),
      );
    } catch (exception) {
      if (exception instanceof TransactionCanceledException) {
        const { CancellationReasons } = exception;
        if (!CancellationReasons)
          throw new InternalServerException({ throwable: exception });
        if (
          CancellationReasons[0].Code ===
            DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED ||
          CancellationReasons[1].Code ===
            DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED ||
          CancellationReasons[2].Code ===
            DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          return;
      }
      throw new InternalServerException({ throwable: exception });
    }
  }
}
