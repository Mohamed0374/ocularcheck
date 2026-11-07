import { Body, Controller, Module, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEmail, MinLength, ValidateNested } from 'class-validator';
import { Prisma } from '../src/generated/prisma/client.js';

/**
 * TEST-ONLY rig controllers (P2-T3): never registered in AppModule; imported
 * only by the foundations/logging e2e specs to drive every branch of the
 * shared bootstrap (configure-app) — the real application modules stay
 * free of controllers and business logic.
 */

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
  @Post('echo')
  echo(@Body() dto: EchoDto): { email: string; name: string } {
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
}

@Module({
  controllers: [FoundationsRigController],
})
export class FoundationsRigModule {}
