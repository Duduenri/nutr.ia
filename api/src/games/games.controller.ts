import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseDay, todayIn } from '../common/date';
import { PrismaService } from '../prisma/prisma.service';
import { dailyIndex, dailySudoku, type SudokuLevel } from './sudoku';
import { displayWord, isValidWord, TERMO_ANSWERS } from './termo-words';

const DEFAULT_TZ = 'America/Sao_Paulo';
const MAX_TRIES = 6;
const TERMO_GEMS = [60, 50, 40, 30, 20, 15];
const SUDOKU_GEMS: Record<SudokuLevel, number> = {
  easy: 20,
  medium: 35,
  hard: 50,
};
const LEVELS: SudokuLevel[] = ['easy', 'medium', 'hard'];

type LetterResult = 'correct' | 'present' | 'absent';

interface TermoState {
  guesses: string[];
}

function normalize(word: string): string {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function score(guess: string, answer: string): LetterResult[] {
  const result = Array<LetterResult>(5).fill('absent');
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) result[i] = 'correct';
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    if (left[guess[i]]) {
      result[i] = 'present';
      left[guess[i]]--;
    }
  }
  return result;
}

class GuessDto {
  @IsString()
  @Length(5, 5, { message: 'A palavra tem 5 letras' })
  guess!: string;
}

class SudokuDto {
  @IsIn(LEVELS)
  level!: SudokuLevel;

  @IsArray()
  @ArrayMinSize(81)
  @ArrayMaxSize(81)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(9, { each: true })
  grid!: number[];
}

@Controller('games')
@UseGuards(AuthGuard)
export class GamesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async overview(@UserId() userId: string) {
    const day = await this.today(userId);
    const rows = await this.prisma.gameDay.findMany({
      where: { userId, day: parseDay(day) },
    });
    const get = (game: string) => rows.find((r) => r.game === game);
    const termo = get('termo');
    return {
      day,
      termo: {
        finished: termo?.finished ?? false,
        won: termo?.won ?? false,
        tries: (termo?.state as TermoState | undefined)?.guesses.length ?? 0,
        reward: termo?.reward ?? 0,
      },
      sudoku: Object.fromEntries(
        LEVELS.map((l) => [
          l,
          { done: get(`sudoku-${l}`)?.won ?? false, gems: SUDOKU_GEMS[l] },
        ]),
      ),
      gemsToday: rows.reduce((s, r) => s + r.reward, 0),
    };
  }

  @Get('termo')
  async termo(@UserId() userId: string) {
    const day = await this.today(userId);
    const row = await this.prisma.gameDay.findUnique({
      where: { userId_game_day: { userId, game: 'termo', day: parseDay(day) } },
    });
    return this.termoView(day, row);
  }

  @Post('termo/guess')
  @HttpCode(200)
  async guess(@UserId() userId: string, @Body() dto: GuessDto) {
    const day = await this.today(userId);
    const word = normalize(dto.guess);
    if (!/^[a-z]{5}$/.test(word) || !isValidWord(word)) {
      throw new BadRequestException('Essa palavra não está no dicionário');
    }
    const key = { userId, game: 'termo', day: parseDay(day) };
    const row = await this.prisma.gameDay.findUnique({
      where: { userId_game_day: key },
    });
    if (row?.finished) {
      throw new BadRequestException('O Termo de hoje já acabou');
    }
    const guesses = [
      ...((row?.state as TermoState | undefined)?.guesses ?? []),
      word,
    ];
    const answer = this.answer(day);
    const won = word === answer;
    const finished = won || guesses.length >= MAX_TRIES;
    const reward = won ? TERMO_GEMS[guesses.length - 1] : 0;
    const saved = await this.prisma.$transaction(async (tx) => {
      const r = await tx.gameDay.upsert({
        where: { userId_game_day: key },
        create: {
          ...key,
          state: { guesses },
          won,
          finished,
          reward,
        },
        update: {
          state: { guesses },
          won,
          finished,
          reward,
        },
      });
      if (reward) {
        await tx.gemTx.create({
          data: {
            userId,
            amount: reward,
            reason: `Termo do dia em ${guesses.length} tentativa(s)`,
            refKey: `game:termo:${day}`,
          },
        });
      }
      return r;
    });
    return this.termoView(day, saved);
  }

  @Get('sudoku')
  async sudoku(@UserId() userId: string, @Query('level') level: string) {
    if (!LEVELS.includes(level as SudokuLevel)) {
      throw new BadRequestException('Nível inválido');
    }
    const day = await this.today(userId);
    const { puzzle } = dailySudoku(day, level as SudokuLevel);
    const row = await this.prisma.gameDay.findUnique({
      where: {
        userId_game_day: {
          userId,
          game: `sudoku-${level}`,
          day: parseDay(day),
        },
      },
    });
    return {
      day,
      level,
      puzzle,
      done: row?.won ?? false,
      gems: SUDOKU_GEMS[level as SudokuLevel],
    };
  }

  @Post('sudoku/submit')
  @HttpCode(200)
  async submitSudoku(@UserId() userId: string, @Body() dto: SudokuDto) {
    const day = await this.today(userId);
    const { puzzle, solution } = dailySudoku(day, dto.level);
    const wrong = dto.grid.some((n, i) => n !== solution[i]);
    const tampered = puzzle.some((n, i) => n !== 0 && dto.grid[i] !== n);
    if (wrong || tampered) {
      return { solved: false, reward: 0 };
    }
    const key = { userId, game: `sudoku-${dto.level}`, day: parseDay(day) };
    const row = await this.prisma.gameDay.findUnique({
      where: { userId_game_day: key },
    });
    if (row?.won) return { solved: true, reward: 0, already: true };
    const reward = SUDOKU_GEMS[dto.level];
    await this.prisma.$transaction([
      this.prisma.gameDay.upsert({
        where: { userId_game_day: key },
        create: { ...key, state: {}, won: true, finished: true, reward },
        update: { won: true, finished: true, reward },
      }),
      this.prisma.gemTx.create({
        data: {
          userId,
          amount: reward,
          reason: `Sudoku ${dto.level === 'easy' ? 'fácil' : dto.level === 'medium' ? 'médio' : 'difícil'} do dia`,
          refKey: `game:sudoku-${dto.level}:${day}`,
        },
      }),
    ]);
    return { solved: true, reward };
  }

  private answer(day: string): string {
    return TERMO_ANSWERS[dailyIndex(day, TERMO_ANSWERS.length)];
  }

  private termoView(
    day: string,
    row: {
      state: Prisma.JsonValue;
      won: boolean;
      finished: boolean;
      reward: number;
    } | null,
  ) {
    const guesses = (row?.state as TermoState | undefined)?.guesses ?? [];
    const answer = this.answer(day);
    return {
      day,
      maxTries: MAX_TRIES,
      rows: guesses.map((g) => ({
        word: displayWord(g),
        letters: g.split(''),
        result: score(g, answer),
      })),
      finished: row?.finished ?? false,
      won: row?.won ?? false,
      reward: row?.reward ?? 0,
      answer: row?.finished ? displayWord(answer) : null,
      gems: TERMO_GEMS,
    };
  }

  private async today(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    return todayIn(user.timezone ?? DEFAULT_TZ);
  }
}
