import { AssignmentTaskType } from '../../../../../../../common/common-domain/AssignmentTaskType';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export default class CreateClassAssignmentDto {
  @ApiProperty()
  @IsString({ message: 'The title must be a string' })
  @IsNotEmpty({ message: 'The title is required' })
  @MaxLength(128, { message: 'The title must be less than 128 characters' })
  public title: string;

  @ApiProperty()
  @IsString({ message: 'The submission must be a string' })
  @IsNotEmpty({ message: 'The submission is required' })
  @MaxLength(128, {
    message: 'The submission must be less than 128 characters',
  })
  public submission: string;

  @ApiProperty({
    example: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
  })
  @IsISO8601(
    { strict: true },
    { message: 'The deadline must be a valid ISO8601 date string' },
  )
  public deadline: string;

  @ApiProperty()
  @IsString({ message: 'The description must be a string' })
  @MaxLength(2048, {
    message: 'The description must be less than 2048 characters',
  })
  public description: string;

  @ApiProperty({ enum: AssignmentTaskType })
  @IsEnum(AssignmentTaskType, {
    message: 'The task type must be a valid AssignmentTaskType',
  })
  public taskType: AssignmentTaskType;
}
