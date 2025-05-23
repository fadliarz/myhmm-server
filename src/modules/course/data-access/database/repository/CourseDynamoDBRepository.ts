import { Inject, Injectable } from '@nestjs/common';
import { DependencyInjection } from '../../../../../common/common-domain/DependencyInjection';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import DynamoDBConfig from '../../../../../config/DynamoDBConfig';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import DynamoDBBuilder from '../../../../../common/common-data-access/UpdateBuilder';
import strictPlainToClass from '../../../../../common/common-domain/mapper/strictPlainToClass';
import CourseEntity from '../entity/CourseEntity';
import CourseKey from '../entity/CourseKey';
import Pagination from '../../../../../common/common-domain/repository/Pagination';
import CategoryLinkKey from '../../../../category/data-access/database/entity/CategoryLinkKey';
import { DynamoDBExceptionCode } from '../../../../../common/common-domain/DynamoDBExceptionCode';
import CourseNotFoundException from '../../../domain/domain-core/exception/CourseNotFoundException';
import DuplicateKeyException from '../../../../../common/common-domain/exception/DuplicateKeyException';
import InternalServerException from '../../../../../common/common-domain/exception/InternalServerException';

@Injectable()
export default class CourseDynamoDBRepository {
  constructor(
    @Inject(DependencyInjection.DYNAMODB_DOCUMENT_CLIENT)
    private readonly dynamoDBDocumentClient: DynamoDBDocumentClient,
    private readonly dynamoDBConfig: DynamoDBConfig,
  ) {}

  public async saveIfNotExistsOrThrow(param: {
    courseEntity: CourseEntity;
  }): Promise<void> {
    const { courseEntity } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new PutCommand({
          TableName: this.dynamoDBConfig.COURSE_TABLE,
          Item: { ...courseEntity, id: 'COURSE' },
          ConditionExpression:
            'attribute_not_exists(id) AND attribute_not_exists(courseId)',
        }),
      );
    } catch (exception) {
      if (exception instanceof ConditionalCheckFailedException)
        throw new DuplicateKeyException({ throwable: exception });
      throw new InternalServerException({ throwable: exception });
    }
  }

  public async addCategoryIfNotExistsOrIgnore(param: {
    courseId: number;
    categoryId: number;
  }): Promise<void> {
    const { courseId, categoryId } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.dynamoDBConfig.COURSE_TABLE,
                Key: new CourseKey({ courseId }),
                ConditionExpression:
                  'attribute_exists(id) AND attribute_exists(courseId)',
                UpdateExpression: 'ADD #categories :categoryId',
                ExpressionAttributeNames: {
                  '#categories': 'categories',
                },
                ExpressionAttributeValues: {
                  ':categoryId': new Set([categoryId]),
                },
              },
            },
            {
              Put: {
                TableName: this.dynamoDBConfig.CATEGORY_TABLE,
                Item: new CategoryLinkKey({ categoryId, courseId }),
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
          throw new CourseNotFoundException();
      }
      throw new InternalServerException({ throwable: exception });
    }
  }

  public async removeCategoryIfExistsOrIgnore(param: {
    courseId: number;
    categoryId: number;
  }): Promise<void> {
    const { courseId, categoryId } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.dynamoDBConfig.COURSE_TABLE,
                Key: new CourseKey({ courseId }),
                ConditionExpression:
                  'attribute_exists(id) AND attribute_exists(courseId)',
                UpdateExpression: 'DELETE #categories :categoryId',
                ExpressionAttributeNames: {
                  '#categories': 'categories',
                },
                ExpressionAttributeValues: {
                  ':categoryId': new Set([categoryId]),
                },
              },
            },
            {
              Delete: {
                TableName: this.dynamoDBConfig.CATEGORY_TABLE,
                Key: new CategoryLinkKey({ categoryId, courseId }),
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
          throw new CourseNotFoundException({ throwable: exception });
      }
      throw new InternalServerException({ throwable: exception });
    }
  }

  public async findMany(param: {
    pagination: Pagination;
  }): Promise<CourseEntity[]> {
    const { pagination } = param;
    const courseEntities: CourseEntity[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    let limit: number | undefined = pagination.limit;
    do {
      if (limit === 0) break;
      const { Items, LastEvaluatedKey } =
        await this.dynamoDBDocumentClient.send(
          new QueryCommand({
            TableName: this.dynamoDBConfig.COURSE_TABLE,
            KeyConditionExpression: pagination.lastEvaluatedId
              ? '#id = :value0 AND courseId < :value1'
              : '#id = :value0',
            ExpressionAttributeNames: {
              '#id': 'id',
            },
            ExpressionAttributeValues: {
              ':value0': 'COURSE',
              ...(pagination.lastEvaluatedId
                ? { ':value1': pagination.lastEvaluatedId }
                : {}),
            },
            ExclusiveStartKey: lastEvaluatedKey,
            Limit: limit,
          }),
        );
      if (Items) {
        courseEntities.push(
          ...Items.map((item) => strictPlainToClass(CourseEntity, item)),
        );
      }
      lastEvaluatedKey = LastEvaluatedKey as Record<string, any> | undefined;
      if (limit) {
        limit = pagination.limit - courseEntities.length;
      }
    } while (lastEvaluatedKey);
    return courseEntities;
  }

  public async findById(param: {
    courseId: number;
  }): Promise<CourseEntity | null> {
    const { courseId } = param;
    const response = await this.dynamoDBDocumentClient.send(
      new GetCommand({
        TableName: this.dynamoDBConfig.COURSE_TABLE,
        Key: new CourseKey({ courseId }),
      }),
    );
    return response.Item
      ? strictPlainToClass(CourseEntity, response.Item)
      : null;
  }

  public async findByIdOrThrow(param: {
    courseId: number;
  }): Promise<CourseEntity> {
    const { courseId } = param;
    const response = await this.dynamoDBDocumentClient.send(
      new GetCommand({
        TableName: this.dynamoDBConfig.COURSE_TABLE,
        Key: new CourseKey({ courseId }),
      }),
    );
    if (!response.Item) {
      throw new CourseNotFoundException();
    }
    return strictPlainToClass(CourseEntity, response.Item);
  }

  public async saveIfExistsOrThrow(param: {
    courseEntity: CourseEntity;
  }): Promise<void> {
    const { courseEntity } = param;
    try {
      const { courseId, ...restObj } = courseEntity;
      const updateObj = DynamoDBBuilder.buildUpdate(restObj);
      if (!updateObj) return;
      await this.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: this.dynamoDBConfig.COURSE_TABLE,
          Key: new CourseKey({ courseId }),
          ...updateObj,
          ConditionExpression:
            'attribute_exists(id) AND attribute_exists(courseId)',
        }),
      );
    } catch (exception) {
      if (exception instanceof ConditionalCheckFailedException)
        throw new CourseNotFoundException({ throwable: exception });
      throw new InternalServerException({ throwable: exception });
    }
  }

  public async deleteIfExistsOrThrow(param: {
    courseId: number;
  }): Promise<void> {
    const { courseId } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new DeleteCommand({
          TableName: this.dynamoDBConfig.COURSE_TABLE,
          Key: new CourseKey({ courseId }),
          ConditionExpression:
            'attribute_exists(id) AND attribute_exists(courseId)',
        }),
      );
    } catch (exception) {
      if (exception instanceof ConditionalCheckFailedException) return;
      throw new InternalServerException({ throwable: exception });
    }
  }
}
