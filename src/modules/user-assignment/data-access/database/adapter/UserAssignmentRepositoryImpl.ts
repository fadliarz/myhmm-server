import { Injectable } from '@nestjs/common';
import { UserAssignmentRepository } from '../../../domain/application-service/ports/output/repository/UserAssignmentRepository';
import DomainException from '../../../../../common/common-domain/exception/DomainException';
import UserAssignment from '../../../domain/domain-core/entity/UserAssignment';
import UserAssignmentDynamoDBRepository from '../repository/UserAssignmentDynamoDBRepository';
import strictPlainToClass from '../../../../../common/common-domain/mapper/strictPlainToClass';
import UserAssignmentEntity from '../entity/UserAssignmentEntity';
import Pagination from '../../../../../common/common-domain/repository/Pagination';

@Injectable()
export default class UserAssignmentRepositoryImpl
  implements UserAssignmentRepository
{
  constructor(
    private readonly userAssignmentDynamoDBRepository: UserAssignmentDynamoDBRepository,
  ) {}

  public async saveIfNotExistsOrThrow(param: {
    userAssignment: UserAssignment;
    domainException: DomainException;
  }): Promise<void> {
    await this.userAssignmentDynamoDBRepository.saveIfNotExistsOrThrow({
      ...param,
      userAssignmentEntity: strictPlainToClass(
        UserAssignmentEntity,
        param.userAssignment,
      ),
    });
  }

  public async findMany(param: {
    userId: number;
    pagination: Pagination;
  }): Promise<UserAssignment[]> {
    const userAssignmentEntities: UserAssignmentEntity[] =
      await this.userAssignmentDynamoDBRepository.findMany(param);
    return userAssignmentEntities.map((userAssignmentEntity) =>
      strictPlainToClass(UserAssignment, userAssignmentEntity),
    );
  }

  public async findByIdOrThrow(param: {
    userId: number;
    assignmentId: number;
    domainException: DomainException;
  }): Promise<UserAssignment> {
    return strictPlainToClass(
      UserAssignment,
      await this.userAssignmentDynamoDBRepository.findByIdOrThrow(param),
    );
  }

  public async saveIfExistsAndAssignmentIsPersonalOrThrow(param: {
    userAssignment: UserAssignment;
    notFoundException: DomainException;
    domainException: DomainException;
  }): Promise<void> {
    await this.userAssignmentDynamoDBRepository.saveIfExistsAndAssignmentIsPersonalOrThrow(
      {
        ...param,
        userAssignmentEntity: strictPlainToClass(
          UserAssignmentEntity,
          param.userAssignment,
        ),
      },
    );
  }

  public async deleteIfExistsAndAssignmentIsPersonalOrThrow(param: {
    userId: number;
    assignmentId: number;
    notFoundException: DomainException;
    domainException: DomainException;
  }): Promise<void> {
    await this.userAssignmentDynamoDBRepository.deleteIfExistsAndAssignmentIsPersonalOrThrow(
      param,
    );
  }
}
