import { Inject, Injectable } from '@nestjs/common';
import DynamoDBConfig from '../../../../../config/DynamoDBConfig';
import UserEntity from '../entity/UserEntity';
import DomainException from '../../../../../common/common-domain/exception/DomainException';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import strictPlainToClass from '../../../../../common/common-domain/mapper/strictPlainToClass';
import DynamoDBBuilder from '../../../../../common/common-data-access/UpdateBuilder';
import { DependencyInjection } from '../../../../../common/common-domain/DependencyInjection';
import UniqueEmailKey from '../entity/UniqueEmailKey';
import UserKey from '../entity/UserKey';
import { DynamoDBExceptionCode } from '../../../../../common/common-domain/DynamoDBExceptionCode';

@Injectable()
export default class UserDynamoDBRepository {
  constructor(
    @Inject(DependencyInjection.DYNAMODB_DOCUMENT_CLIENT)
    private readonly dynamoDBDocumentClient: DynamoDBDocumentClient,
    private readonly dynamoDBConfig: DynamoDBConfig,
  ) {}

  public async saveIfEmailNotTakenOrThrow(param: {
    userEntity: UserEntity;
    domainException: DomainException;
  }): Promise<void> {
    const { userEntity, domainException } = param;
    try {
      await this.dynamoDBDocumentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.dynamoDBConfig.USER_TABLE,
                Item: { ...userEntity, id: 'USER' },
                ConditionExpression:
                  'attribute_not_exists(id) AND attribute_not_exists(userId)',
              },
            },
            {
              Put: {
                TableName: this.dynamoDBConfig.USER_TABLE,
                Item: new UniqueEmailKey({
                  email: userEntity.email,
                  userId: userEntity.userId,
                }),
                ConditionExpression:
                  'attribute_not_exists(id) AND attribute_not_exists(userId)',
              },
            },
          ],
        }),
      );
    } catch (exception) {
      if (exception instanceof TransactionCanceledException) {
        const { CancellationReasons } = exception;
        if (!CancellationReasons) throw exception;
        if (
          CancellationReasons[0].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw new DomainException();
        if (
          CancellationReasons[1].Code ===
          DynamoDBExceptionCode.CONDITIONAL_CHECK_FAILED
        )
          throw domainException;
      }
      throw exception;
    }
  }

  public async findByIdOrThrow(param: {
    userId: number;
    domainException: DomainException;
  }): Promise<UserEntity> {
    const { userId, domainException } = param;
    const response = await this.dynamoDBDocumentClient.send(
      new GetCommand({
        TableName: this.dynamoDBConfig.USER_TABLE,
        Key: new UserKey({ userId }),
      }),
    );
    if (!response.Item) {
      throw domainException;
    }
    return strictPlainToClass(UserEntity, response.Item);
  }

  public async findByEmailOrThrow(param: {
    email: string;
    domainException: DomainException;
  }): Promise<{ userId: number }> {
    const { email, domainException } = param;
    const response = await this.dynamoDBDocumentClient.send(
      new QueryCommand({
        TableName: this.dynamoDBConfig.USER_TABLE,
        KeyConditionExpression: '#id = :value0 AND #userId = :value1',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#userId': 'userId',
        },
        ExpressionAttributeValues: {
          ':value0': email,
          ':value1': 0,
        },
        Limit: 1,
      }),
    );
    if (!response.Items || response.Items.length === 0) {
      throw domainException;
    }
    return {
      userId: (response.Items[0] as UniqueEmailKey).storedUserId,
    };
  }

  public async saveIfExistsOrThrow(param: {
    userEntity: UserEntity;
    domainException: DomainException;
  }): Promise<void> {
    const { userEntity, domainException } = param;
    try {
      const { userId, ...restObj } = userEntity;
      const updateObj = DynamoDBBuilder.buildUpdate(restObj);
      if (!updateObj) return;
      await this.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: this.dynamoDBConfig.USER_TABLE,
          Key: new UserKey({ userId }),
          ...updateObj,
          ConditionExpression:
            'attribute_exists(id) AND attribute_exists(userId)',
        }),
      );
    } catch (exception) {
      if (exception instanceof ConditionalCheckFailedException) {
        throw domainException;
      }
    }
  }
}
