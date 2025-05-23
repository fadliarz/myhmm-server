import { Injectable } from '@nestjs/common';
import { ScholarshipRepository } from '../../../domain/application-service/ports/output/repository/ScholarshipRepository';
import Scholarship from '../../../domain/domain-core/entity/Scholarship';
import ScholarshipDynamoDBRepository from '../repository/ScholarshipDynamoDBRepository';
import strictPlainToClass from '../../../../../common/common-domain/mapper/strictPlainToClass';
import ScholarshipEntity from '../entity/ScholarshipEntity';
import Pagination from '../../../../../common/common-domain/repository/Pagination';

@Injectable()
export default class ScholarshipRepositoryImpl
  implements ScholarshipRepository
{
  constructor(
    private readonly scholarshipDynamoDBRepository: ScholarshipDynamoDBRepository,
  ) {}

  public async saveIfNotExistsOrThrow(param: {
    scholarship: Scholarship;
  }): Promise<void> {
    await this.scholarshipDynamoDBRepository.saveIfNotExistsOrThrow({
      ...param,
      scholarshipEntity: strictPlainToClass(
        ScholarshipEntity,
        param.scholarship,
      ),
    });
  }

  public async addTagIfNotExistsOrIgnore(param: {
    scholarshipId: number;
    tagId: number;
  }): Promise<void> {
    await this.scholarshipDynamoDBRepository.addTagIfNotExistsOrIgnore(param);
  }

  public async removeTagIfExistsOrIgnore(param: {
    scholarshipId: number;
    tagId: number;
  }): Promise<void> {
    await this.scholarshipDynamoDBRepository.removeTagIfExistsOrIgnore(param);
  }

  public async findMany(param: {
    pagination: Pagination;
  }): Promise<Scholarship[]> {
    const scholarshipEntities: ScholarshipEntity[] =
      await this.scholarshipDynamoDBRepository.findMany(param);
    return scholarshipEntities.map((scholarshipEntity) =>
      strictPlainToClass(Scholarship, scholarshipEntity),
    );
  }

  public async findById(param: {
    scholarshipId: number;
  }): Promise<Scholarship | null> {
    const scholarshipEntity: ScholarshipEntity | null =
      await this.scholarshipDynamoDBRepository.findById(param);
    return scholarshipEntity
      ? strictPlainToClass(Scholarship, scholarshipEntity)
      : null;
  }

  public async findByIdOrThrow(param: {
    scholarshipId: number;
  }): Promise<Scholarship> {
    return strictPlainToClass(
      Scholarship,
      await this.scholarshipDynamoDBRepository.findByIdOrThrow(param),
    );
  }

  public async saveIfExistsOrThrow(param: {
    scholarship: Scholarship;
  }): Promise<void> {
    await this.scholarshipDynamoDBRepository.saveIfExistsOrThrow({
      ...param,
      scholarshipEntity: strictPlainToClass(
        ScholarshipEntity,
        param.scholarship,
      ),
    });
  }

  public async deleteIfExistsOrThrow(param: {
    scholarshipId: number;
  }): Promise<void> {
    await this.scholarshipDynamoDBRepository.deleteIfExistsOrThrow(param);
  }
}
