import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { PhotosService } from '../photos/photos.service';
import { AiService, type FoodAnalysis } from './ai.service';

class PhotoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

class TextDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  text!: string;
}

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly photos: PhotosService,
  ) {}

  @Post('photo')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  async photo(
    @UserId() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PhotoDto,
  ) {
    if (!file?.mimetype.startsWith('image/')) {
      throw new BadRequestException('Envie uma imagem');
    }
    const photo = await this.photos.save(userId, file.buffer);
    let analysis: FoodAnalysis;
    try {
      analysis = await this.ai.analyzePhoto(
        photo.jpeg.toString('base64'),
        dto.description,
      );
    } catch (error) {
      await this.photos.remove(userId, photo.id);
      throw error;
    }
    return {
      photoId: photo.id,
      photoUrl: `/api/photos/${photo.id}/file`,
      ...analysis,
    };
  }

  @Post('text')
  @HttpCode(200)
  text(@Body() dto: TextDto) {
    return this.ai.analyzeText(dto.text);
  }
}
