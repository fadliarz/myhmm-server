import { Injectable } from '@nestjs/common';
import { UserScheduleRepository } from '../../../domain/application-service/ports/output/repository/UserScheduleRepository';
import DomainException from '../../../../../common/common-domain/exception/DomainException';
import Pagination from '../../../../../common/common-domain/repository/Pagination';
import UserSchedule from '../../../domain/domain-core/entity/UserSchedule';
import UserScheduleDynamoDBRepository from '../repository/UserScheduleDynamoDBRepository';
import strictPlainToClass from '../../../../../common/common-domain/mapper/strictPlainToClass';
import UserScheduleEntity from '../entity/UserScheduleEntity';

@Injectable()
export default class UserScheduleRepositoryImpl
  implements UserScheduleRepository
{
  constructor(
    private readonly userScheduleDynamoDBRepository: UserScheduleDynamoDBRepository,
  ) {}

  public async findByIdOrThrow(param: {
    userId: number;
    scheduleId: number;
    domainException: DomainException;
  }): Promise<UserSchedule> {
    return strictPlainToClass(
      UserSchedule,
      await this.userScheduleDynamoDBRepository.findByIdOrThrow(param),
    );
  }

  public async findMany(param: {
    userId: number;
    pagination: Pagination;
  }): Promise<UserSchedule[]> {
    const userScheduleEntities: UserScheduleEntity[] =
      await this.userScheduleDynamoDBRepository.findMany(param);
    return userScheduleEntities.map((entity) =>
      strictPlainToClass(UserSchedule, entity),
    );
  }
}
