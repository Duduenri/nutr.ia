import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { requireEnv } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_COOKIE } from './auth.guard';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class RegisterDto extends LoginDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(6)
  declare password: string;

  @IsString()
  inviteCode!: string;
}

const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 90;

@Controller('auth')
export class AuthController {
  private readonly inviteCode = requireEnv('INVITE_CODE');
  private readonly secureCookie = requireEnv('COOKIE_SECURE') === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (dto.inviteCode !== this.inviteCode) {
      throw new ForbiddenException('Código de convite inválido');
    }
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    await this.setCookie(res, user.id);
    return { id: user.id };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    await this.setCookie(res, user.id);
    return { id: user.id };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE);
    return { ok: true };
  }

  private async setCookie(res: Response, userId: string) {
    const token = await this.jwt.signAsync({ sub: userId });
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secureCookie,
      maxAge: COOKIE_MAX_AGE,
    });
  }
}
