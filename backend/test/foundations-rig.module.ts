import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEmail, MinLength, ValidateNested } from 'class-validator';

import { ApiErrorResponses, ApiOkEnvelope } from '../src/common/swagger/response-models.js';
import { Prisma } from '../src/generated/prisma/client.js';

/**
 * TEST-ONLY rig controllers (P2-T3/P2-T4): never registered in AppModule;
 * imported only by the foundations e2e specs to drive every branch of the
 * shared bootstrap (configure-app) through the /api/v1 versioned surface.
 * They also demonstrate the shared Swagger decorators (ApiOkEnvelope /
 * ApiErrorResponses) — production controllers use them the same way.
 */

export class EchoResponseDto {
  @IsEmail()
  email!: string;

  @MinLength(2)
  name!: string;
}

class EchoDto {
  @IsEmail()
  email!: string;

  @MinLength(2)
  name!: string;
}

class ContactDto {
  @IsEmail()
  email!: string;
}

class NestedDto {
  @ValidateNested()
  @Type(() => ContactDto)
  contact!: ContactDto;
}

const CLIENT_VERSION = '7.10.1';

@Controller('test-rig')
export class FoundationsRigController {
  @ApiOkEnvelope(EchoResponseDto)
  @ApiErrorResponses(422)
  @Post('echo')
  echo(@Body() dto: EchoDto): EchoResponseDto {
    return { email: dto.email, name: dto.name };
  }

  @Post('nested')
  nested(@Body() dto: NestedDto): { done: boolean } {
    // Uses the validated payload (ValidationPipe only validates bound params).
    return { done: dto.contact.email.length >= 0 };
  }

  @Post('throw')
  boom(): never {
    // A deliberately identifiable unexpected failure.
    throw new Error('secret db password=abc');
  }

  @Post('prisma-conflict')
  prismaConflict(): never {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: CLIENT_VERSION,
      meta: { target: ['email'], modelName: 'User' },
    });
  }

  /** Marker route used by the versioning e2e assertions. */
  @Get('version-marker')
  versionMarker(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  controllers: [FoundationsRigController],
})
export class FoundationsRigModule {}
