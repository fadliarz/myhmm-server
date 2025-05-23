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
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import DynamoDBBuilder from '../../../../../common/common-data-access/UpdateBuilder';
import strictPlainToClass from '../../../../../common/common-domain/mapper/strictPlainToClass';
import ClassAssignmentEntity from '../entity/ClassAssignmentEntity';
import ClassKey from '../../../../class/data-access/database/entity/ClassKey';
import CourseKey from '../../../../course/data-access/database/entity/CourseKey';
import ClassAssignmentKey from '../../../domain/domain-core/entity/ClassAssignmentKey';
import Pagination from '../../../../../common/common-domain/repository/Pagination';
import { DynamoDBExceptionCode } from '../../../../../common/common-domain/DynamoDBExceptionCode';
import ClassNotFoundException from '../../../../class/domain/domain-core/exception/ClassNotFoundException';
import InternalServerException from '../../../../../common/common-domain/exception/InternalServerException';
import DuplicateKeyException from '../../../../../common/common-domain/exception/DuplicateKeyException';
import CourseNotFoundException from '../../../../course/domain/domain-core/exception/CourseNotFoundException';
import ClassAssignmentNotFoundException from '../../../domain/domain-core/exception/ClassAssignmentNotFoundException';

@Injectable()
export default class ClassAssignmentDynamoDBRepository {
  constructor(
    @Inject(DependencyInjection.DYNAMODB_DOCUMENT_CLIENT)
    private readonly dynamoDBDocumentClient: DynamoDBDocumentClient,
    private readonly dynamoDBConfig: DynamoDBConfig,
  ) {}

  public async saveIfNotExistsOrThrow(param: {
    classAssignmentEntity: ClassAssignmentEntity;
  }): Promise<void> {
    const { classAssignmentEntity } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.dynamoDBConfig.CLASS_ASSIGNMENT_TABLE,
                Item: classAssignmentEntity,
                ConditionExpression:
                  'attribute_not_exists(classId) AND attribute_not_exists(assignmentId)',
              },
            },
            {
              Update: {
                TableName: this.dynamoDBConfig.CLASS_TABLE,
                Key: new ClassKey({
                  courseId: classAssignmentEntity.courseId,
                  classId: classAssignmentEntity.classId,
                }),
                ConditionExpression:
                  'attribute_exists(courseId) AND attribute_exists(classId)',
                UpdateExpression: 'ADD #numberOfAssignments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAssignments': 'numberOfAssignments',
                },
                ExpressionAttributeValues: {
                  ':value0': 1,
                },
              },
            },
            {
              Update: {
                TableName: this.dynamoDBConfig.COURSE_TABLE,
                Key: new CourseKey({
                  courseId: classAssignmentEntity.courseId,
                }),
                ConditionExpression:
                  'attribute_exists(id) AND attribute_exists(courseId)',
                UpdateExpression: 'ADD #numberOfAssignments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAssignments': 'numberOfAssignments',
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
        if (!CancellationReasons)
          throw new InternalServerException({ throwable: exception });
        if (
          CancellationReasons[0].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw new DuplicateKeyException({ throwable: exception });
        if (
          CancellationReasons[1].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw new CourseNotFoundException({ throwable: exception });
        if (
          CancellationReasons[2].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw new ClassNotFoundException({ throwable: exception });
      }
      throw new InternalServerException({ throwable: exception });
    }
  }

  public async findMany(param: {
    classId: number;
    pagination: Pagination;
  }): Promise<ClassAssignmentEntity[]> {
    const { classId, pagination } = param;
    const classAssignmentEntities: ClassAssignmentEntity[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    let limit: number | undefined = pagination.limit;
    do {
      if (limit === 0) break;
      const { Items, LastEvaluatedKey } =
        await this.dynamoDBDocumentClient.send(
          new QueryCommand({
            TableName: this.dynamoDBConfig.CLASS_ASSIGNMENT_TABLE,
            KeyConditionExpression: pagination.lastEvaluatedId
              ? '#classId = :value0 AND assignmentId < :value1'
              : '#classId = :value0',
            ExpressionAttributeNames: {
              '#classId': 'classId',
            },
            ExpressionAttributeValues: {
              ':value0': classId,
              ...(pagination.lastEvaluatedId
                ? { ':value1': pagination.lastEvaluatedId }
                : {}),
            },
            ExclusiveStartKey: lastEvaluatedKey,
            Limit: limit,
          }),
        );
      if (Items) {
        classAssignmentEntities.push(
          ...Items.map((item) =>
            strictPlainToClass(ClassAssignmentEntity, item),
          ),
        );
      }
      lastEvaluatedKey = LastEvaluatedKey as Record<string, any> | undefined;
      if (limit) {
        limit = pagination.limit - classAssignmentEntities.length;
      }
    } while (lastEvaluatedKey);
    return classAssignmentEntities;
  }

  public async findByIdOrThrow(param: {
    classId: number;
    assignmentId: number;
  }): Promise<ClassAssignmentEntity> {
    const { classId, assignmentId } = param;
    const response = await this.dynamoDBDocumentClient.send(
      new GetCommand({
        TableName: this.dynamoDBConfig.CLASS_ASSIGNMENT_TABLE,
        Key: new ClassAssignmentKey({ classId, assignmentId }),
      }),
    );
    if (!response.Item) {
      throw new ClassAssignmentNotFoundException();
    }
    return strictPlainToClass(ClassAssignmentEntity, response.Item);
  }

  public async saveIfExistsOrThrow(param: {
    classAssignmentEntity: ClassAssignmentEntity;
  }): Promise<void> {
    const { classAssignmentEntity } = param;
    try {
      const { classId, assignmentId, ...restObj } = classAssignmentEntity;
      await this.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: this.dynamoDBConfig.CLASS_ASSIGNMENT_TABLE,
          Key: new ClassAssignmentKey({ classId, assignmentId }),
          ...DynamoDBBuilder.buildUpdate(restObj),
          ConditionExpression:
            'attribute_exists(classId) AND attribute_exists(assignmentId)',
        }),
      );
    } catch (exception) {
      if (exception instanceof ConditionalCheckFailedException)
        throw new ClassAssignmentNotFoundException({ throwable: exception });
      throw new ClassAssignmentNotFoundException({ throwable: exception });
    }
  }

  public async deleteIfExistsOrThrow(param: {
    courseId: number;
    classId: number;
    assignmentId: number;
  }): Promise<void> {
    const { courseId, classId, assignmentId } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.dynamoDBConfig.CLASS_ASSIGNMENT_TABLE,
                Key: new ClassAssignmentKey({ classId, assignmentId }),
                ConditionExpression:
                  'attribute_exists(classId) AND attribute_exists(assignmentId)',
              },
            },
            {
              Update: {
                TableName: this.dynamoDBConfig.CLASS_TABLE,
                Key: new ClassKey({ courseId, classId }),
                ConditionExpression:
                  'attribute_exists(courseId) AND attribute_exists(classId)',
                UpdateExpression: 'ADD #numberOfAssignments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAssignments': 'numberOfAssignments',
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
                UpdateExpression: 'ADD #numberOfAssignments :value0',
                ExpressionAttributeNames: {
                  '#numberOfAssignments': 'numberOfAssignments',
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
        if (!CancellationReasons) throw new InternalServerException();
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
