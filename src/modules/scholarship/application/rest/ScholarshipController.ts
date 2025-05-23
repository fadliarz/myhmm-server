import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { AuthenticationGuard } from '../../../authentication/domain/application-service/AuthenticationGuard';
import CreateScholarshipCommandHandler from '../../domain/application-service/features/create-scholarship/CreateScholarshipCommandHandler';
import CreateScholarshipDto from '../../domain/application-service/features/create-scholarship/dto/CreateScholarshipDto';
import GetScholarshipsQueryHandler from '../../domain/application-service/features/get-scholarships/GetScholarshipsQueryHandler';
import GetScholarshipQueryHandler from '../../domain/application-service/features/get-scholarship/GetScholarshipQueryHandler';
import UpdateScholarshipCommandHandler from '../../domain/application-service/features/update-scholarship/UpdateScholarshipCommandHandler';
import UpdateScholarshipDto from '../../domain/application-service/features/update-scholarship/dto/UpdateScholarshipDto';
import DeleteScholarshipCommandHandler from '../../domain/application-service/features/delete-scholarship/DeleteScholarshipCommandHandler';
import ScholarshipWrapperResponse from './response/ScholarshipWrapperResponse';
import ScholarshipsWrapperResponse from './response/ScholarshipsWrapperResponse';
import AddScholarshipTagCommandHandler from '../../domain/application-service/features/add-tag/AddScholarshipTagCommandHandler';
import AddScholarshipTagDto from '../../domain/application-service/features/add-tag/dto/AddScholarshipTagDto';
import RemoveScholarshipTagCommandHandler from '../../domain/application-service/features/remove-tag/RemoveScholarshipTagCommandHandler';
import GetScholarshipsDto from '../../domain/application-service/features/get-scholarships/dto/GetScholarshipsDto';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
@Controller('api/v1')
@ApiTags('Scholarship')
export default class ScholarshipController {
  constructor(
    private readonly createScholarshipCommandHandler: CreateScholarshipCommandHandler,
    private readonly addScholarshipTagCommandHandler: AddScholarshipTagCommandHandler,
    private readonly removeScholarshipTagCommandHandler: RemoveScholarshipTagCommandHandler,
    private readonly getScholarshipsQueryHandler: GetScholarshipsQueryHandler,
    private readonly getScholarshipQueryHandler: GetScholarshipQueryHandler,
    private readonly updateScholarshipCommandHandler: UpdateScholarshipCommandHandler,
    private readonly deleteScholarshipCommandHandler: DeleteScholarshipCommandHandler,
  ) {}

  @UseGuards(AuthenticationGuard)
  @Post('scholarships')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a scholarship' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Scholarship created successfully.',
    type: ScholarshipWrapperResponse,
  })
  public async createScholarship(
    @Req() request: FastifyRequest,
    @Body() createScholarshipDto: CreateScholarshipDto,
  ): Promise<ScholarshipWrapperResponse> {
    return new ScholarshipWrapperResponse(
      await this.createScholarshipCommandHandler.execute({
        executor: request.executor,
        ...createScholarshipDto,
      }),
    );
  }

  @UseGuards(AuthenticationGuard)
  @Post('scholarships/:scholarshipId/add-tag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add tag to a scholarship' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tag added successfully.',
  })
  public async addTag(
    @Req() request: FastifyRequest,
    @Param('scholarshipId', ParseIntPipe) scholarshipId: number,
    @Body() addScholarshipTagDto: AddScholarshipTagDto,
  ): Promise<void> {
    await this.addScholarshipTagCommandHandler.execute({
      executor: request.executor,
      scholarshipId,
      ...addScholarshipTagDto,
    });
  }

  @UseGuards(AuthenticationGuard)
  @Post('scholarships/:scholarshipId/remove-tag/:tagId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove course category' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category removed successfully.',
  })
  public async removeTag(
    @Req() request: FastifyRequest,
    @Param('scholarshipId', ParseIntPipe) scholarshipId: number,
    @Param('tagId', ParseIntPipe) tagId: number,
  ): Promise<void> {
    await this.removeScholarshipTagCommandHandler.execute({
      executor: request.executor,
      scholarshipId,
      tagId,
    });
  }

  @Get('scholarships')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all scholarships' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scholarships retrieved successfully',
    type: ScholarshipsWrapperResponse,
  })
  @ApiQuery({
    type: GetScholarshipsDto,
  })
  public async getScholarships(
    @Query() query: any,
  ): Promise<ScholarshipsWrapperResponse> {
    const getScholarshipsDto: GetScholarshipsDto = plainToClass(
      GetScholarshipsDto,
      query,
    );
    if (getScholarshipsDto.tags) {
      if (!Array.isArray(getScholarshipsDto.tags)) {
        getScholarshipsDto.tags = [getScholarshipsDto.tags];
      }
      getScholarshipsDto.tags = getScholarshipsDto.tags.map((tag) =>
        Number(tag),
      );
    }
    const errors = await validate(getScholarshipsDto);
    if (errors.length > 0) {
      throw new BadRequestException(errors[0].constraints);
    }
    return new ScholarshipsWrapperResponse(
      await this.getScholarshipsQueryHandler.execute({
        ...getScholarshipsDto,
      }),
    );
  }

  @Get('scholarships/:scholarshipId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a specific scholarship' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scholarship retrieved successfully',
    type: ScholarshipWrapperResponse,
  })
  public async getScholarship(
    @Param('scholarshipId', ParseIntPipe) scholarshipId: number,
  ): Promise<ScholarshipWrapperResponse> {
    return new ScholarshipWrapperResponse(
      await this.getScholarshipQueryHandler.execute({
        scholarshipId,
      }),
    );
  }

  @UseGuards(AuthenticationGuard)
  @Patch('scholarships/:scholarshipId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a scholarship' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scholarship updated successfully',
    type: ScholarshipWrapperResponse,
  })
  public async updateScholarship(
    @Param('scholarshipId', ParseIntPipe) scholarshipId: number,
    @Req() request: FastifyRequest,
    @Body() updateScholarshipDto: UpdateScholarshipDto,
  ): Promise<ScholarshipWrapperResponse> {
    return new ScholarshipWrapperResponse(
      await this.updateScholarshipCommandHandler.execute({
        executor: request.executor,
        scholarshipId,
        ...updateScholarshipDto,
      }),
    );
  }

  @UseGuards(AuthenticationGuard)
  @Delete('scholarships/:scholarshipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scholarship' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Scholarship deleted successfully',
  })
  public async deleteScholarship(
    @Param('scholarshipId', ParseIntPipe) scholarshipId: number,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    await this.deleteScholarshipCommandHandler.execute({
      executor: request.executor,
      scholarshipId,
    });
  }
}
