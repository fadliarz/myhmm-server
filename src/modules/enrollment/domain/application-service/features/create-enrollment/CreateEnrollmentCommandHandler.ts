import { Inject, Injectable } from '@nestjs/common';
import { EnrollmentRepository } from '../../ports/output/repository/EnrollmentRepository';
import CreateEnrollmentCommand from './dto/CreateEnrollmentCommand';
import EnrollmentResponse from '../common/EnrollmentResponse';
import strictPlainToClass from '../../../../../../common/common-domain/mapper/strictPlainToClass';
import Enrollment from '../../../domain-core/entity/Enrollment';
import { DependencyInjection } from '../../../../../../common/common-domain/DependencyInjection';
import { ClassRepository } from '../../../../../class/domain/application-service/ports/output/repository/ClassRepository';

@Injectable()
export default class CreateEnrollmentCommandHandler {
  constructor(
    @Inject(DependencyInjection.CLASS_REPOSITORY)
    private readonly classRepository: ClassRepository,
    @Inject(DependencyInjection.ENROLLMENT_REPOSITORY)
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  public async execute(
    createEnrollmentCommand: CreateEnrollmentCommand,
  ): Promise<EnrollmentResponse> {
    await this.classRepository.findByIdOrThrow({
      courseId: createEnrollmentCommand.courseId,
      classId: createEnrollmentCommand.classId,
    });
    const enrollment: Enrollment = strictPlainToClass(
      Enrollment,
      createEnrollmentCommand,
    );
    enrollment.create(createEnrollmentCommand.executor.userId);
    await this.enrollmentRepository.saveIfNotExistsOrThrow({
      enrollment,
    });
    return strictPlainToClass(EnrollmentResponse, enrollment);
  }
}
