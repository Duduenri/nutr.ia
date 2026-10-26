import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Challenge, Prisma } from '@prisma/client';
import { GameService } from '../game/game.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { FriendsService } from './friends.service';

const HOUR_MS = 3_600_000;
const WINNER_TURN_MS = 72 * HOUR_MS;
const OPEN: Challenge['status'][] = ['PENDING', 'ACCEPTED'];

type Tx = Prisma.TransactionClient;

export interface NewChallenge {
  toId: string;
  title: string;
  stake: number;
  deadline: Date;
}

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
    private readonly game: GameService,
    private readonly push: PushService,
  ) {}

  async list(userId: string) {
    await this.expire();
    const [rows, friendIds] = await Promise.all([
      this.prisma.challenge.findMany({
        where: { OR: [{ fromId: userId }, { toId: userId }] },
        include: {
          from: { select: { name: true } },
          to: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.friends.friendIds(userId),
    ]);
    const locks = await Promise.all(
      friendIds.map(async (friendId) => ({
        friendId,
        ...(await this.turn(userId, friendId)),
      })),
    );
    const view = (c: (typeof rows)[number]) => ({
      id: c.id,
      title: c.title,
      stake: c.stake,
      deadline: c.deadline,
      status: c.status,
      proof: c.proof,
      createdAt: c.createdAt,
      resolvedAt: c.resolvedAt,
      fromMe: c.fromId === userId,
      otherId: c.fromId === userId ? c.toId : c.fromId,
      otherName: c.fromId === userId ? c.to.name : c.from.name,
      won: c.winnerId ? c.winnerId === userId : null,
    });
    return {
      open: rows.filter((c) => OPEN.includes(c.status)).map(view),
      history: rows
        .filter((c) => !OPEN.includes(c.status))
        .slice(0, 10)
        .map(view),
      locks,
    };
  }

  private async turn(userId: string, friendId: string) {
    const last = await this.prisma.challenge.findFirst({
      where: {
        OR: [
          { fromId: userId, toId: friendId },
          { fromId: friendId, toId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (last && OPEN.includes(last.status)) {
      return { canChallenge: false, reason: 'open' as const, until: null };
    }
    if (last?.winnerId && last.winnerId !== userId && last.resolvedAt) {
      const until = new Date(last.resolvedAt.getTime() + WINNER_TURN_MS);
      if (until.getTime() > Date.now()) {
        return { canChallenge: false, reason: 'winner' as const, until };
      }
    }
    return { canChallenge: true, reason: null, until: null };
  }

  async create(userId: string, dto: NewChallenge) {
    if (dto.toId === userId) {
      throw new BadRequestException('Não dá pra se desafiar 😄');
    }
    if (!(await this.friends.areFriends(userId, dto.toId))) {
      throw new BadRequestException('Vocês ainda não são amigas');
    }
    const now = Date.now();
    if (dto.deadline.getTime() < now + 30 * 60_000) {
      throw new BadRequestException(
        'O prazo precisa ser daqui a pelo menos 30 min',
      );
    }
    if (dto.deadline.getTime() > now + 14 * 24 * HOUR_MS) {
      throw new BadRequestException('O prazo máximo é de 14 dias');
    }
    await this.expire();
    const turn = await this.turn(userId, dto.toId);
    if (!turn.canChallenge) {
      throw new ConflictException(
        turn.reason === 'open'
          ? 'Já tem um desafio rolando entre vocês'
          : 'Quem ganhou o último desafio escolhe o próximo',
      );
    }
    const { balance } = await this.game.gems(userId);
    if (balance < dto.stake) {
      throw new BadRequestException(`Você tem só ${balance} gemas`);
    }
    const challenge = await this.prisma.$transaction(async (tx) => {
      const c = await tx.challenge.create({
        data: {
          fromId: userId,
          toId: dto.toId,
          title: dto.title.trim(),
          stake: dto.stake,
          deadline: dto.deadline,
        },
        include: { from: { select: { name: true } } },
      });
      await tx.gemTx.create({
        data: {
          userId,
          amount: -dto.stake,
          reason: `Aposta: ${c.title}`,
          refKey: `chal:${c.id}:stake`,
        },
      });
      return c;
    });
    await this.notify(dto.toId, {
      title: `⚔️ ${challenge.from.name} te desafiou!`,
      body: `${challenge.title} · valendo ${challenge.stake} 💎. Aceita?`,
    });
    return challenge;
  }

  async accept(userId: string, id: string) {
    await this.expire();
    const c = await this.find(id, { toId: userId, status: 'PENDING' });
    const { balance } = await this.game.gems(userId);
    if (balance < c.stake) {
      throw new BadRequestException(
        `Precisa de ${c.stake} gemas pra apostar e você tem ${balance}`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.move(tx, id, 'PENDING', {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      });
      await tx.gemTx.create({
        data: {
          userId,
          amount: -c.stake,
          reason: `Aposta: ${c.title}`,
          refKey: `chal:${id}:stake`,
        },
      });
    });
    await this.notify(c.fromId, {
      title: `🔥 ${c.to.name} topou o desafio!`,
      body: `${c.title} · até ${this.when(c.deadline)}`,
    });
  }

  async decline(userId: string, id: string) {
    const c = await this.find(id, { toId: userId, status: 'PENDING' });
    await this.prisma.$transaction(async (tx) => {
      await this.move(tx, id, 'PENDING', {
        status: 'DECLINED',
        respondedAt: new Date(),
        resolvedAt: new Date(),
      });
      await this.refund(tx, c);
    });
    await this.notify(c.fromId, {
      title: `${c.to.name} recusou o desafio`,
      body: `${c.title} · suas ${c.stake} 💎 voltaram`,
    });
  }

  async cancel(userId: string, id: string) {
    const c = await this.find(id, { fromId: userId, status: 'PENDING' });
    await this.prisma.$transaction(async (tx) => {
      await this.move(tx, id, 'PENDING', {
        status: 'CANCELLED',
        resolvedAt: new Date(),
      });
      await this.refund(tx, c);
    });
  }

  async complete(userId: string, id: string, proof?: string) {
    await this.expire();
    const c = await this.find(id, { toId: userId, status: 'ACCEPTED' });
    await this.prisma.$transaction(async (tx) => {
      await this.move(tx, id, 'ACCEPTED', {
        status: 'COMPLETED',
        proof: proof?.trim() || null,
        winnerId: userId,
        resolvedAt: new Date(),
      });
      await this.payWinner(tx, c, userId);
    });
    await this.notify(c.fromId, {
      title: `🏆 ${c.to.name} cumpriu o desafio!`,
      body: `${c.title} · você perdeu ${c.stake} 💎. Agora ${c.to.name} escolhe o próximo desafio.`,
    });
  }

  async giveUp(userId: string, id: string) {
    const c = await this.find(id, { toId: userId, status: 'ACCEPTED' });
    await this.prisma.$transaction(async (tx) => {
      await this.move(tx, id, 'ACCEPTED', {
        status: 'FAILED',
        winnerId: c.fromId,
        resolvedAt: new Date(),
      });
      await this.payWinner(tx, c, c.fromId);
    });
    await this.notify(c.fromId, {
      title: `🏆 Você ganhou o desafio!`,
      body: `${c.to.name} desistiu de "${c.title}". +${c.stake} 💎 e você escolhe o próximo.`,
    });
  }

  async expire() {
    const due = await this.prisma.challenge.findMany({
      where: { status: { in: OPEN }, deadline: { lt: new Date() } },
      include: {
        from: { select: { name: true } },
        to: { select: { name: true } },
      },
    });
    for (const c of due) {
      try {
        if (c.status === 'PENDING') {
          await this.prisma.$transaction(async (tx) => {
            await this.move(tx, c.id, 'PENDING', {
              status: 'EXPIRED',
              resolvedAt: new Date(),
            });
            await this.refund(tx, c);
          });
          continue;
        }
        await this.prisma.$transaction(async (tx) => {
          await this.move(tx, c.id, 'ACCEPTED', {
            status: 'FAILED',
            winnerId: c.fromId,
            resolvedAt: new Date(),
          });
          await this.payWinner(tx, c, c.fromId);
        });
        await this.notify(c.fromId, {
          title: '🏆 Você ganhou o desafio!',
          body: `O prazo de "${c.title}" acabou. +${c.stake} 💎 e você escolhe o próximo.`,
        });
        await this.notify(c.toId, {
          title: '⌛ O prazo do desafio acabou',
          body: `"${c.title}" não foi cumprido: ${c.stake} 💎 foram pra ${c.from.name}.`,
        });
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          this.logger.error(`Desafio ${c.id}: ${String(error)}`);
        }
      }
    }
  }

  private async find(
    id: string,
    where: Prisma.ChallengeWhereInput,
  ): Promise<Challenge & { to: { name: string } }> {
    const c = await this.prisma.challenge.findFirst({
      where: { id, ...where },
      include: { to: { select: { name: true } } },
    });
    if (!c) throw new NotFoundException('Desafio não encontrado ou já mudou');
    return c;
  }

  private async move(
    tx: Tx,
    id: string,
    from: Challenge['status'],
    data: Prisma.ChallengeUpdateManyMutationInput,
  ) {
    const { count } = await tx.challenge.updateMany({
      where: { id, status: from },
      data,
    });
    if (count !== 1) throw new ConflictException('Esse desafio já mudou');
  }

  private refund(tx: Tx, c: Challenge) {
    return tx.gemTx.create({
      data: {
        userId: c.fromId,
        amount: c.stake,
        reason: `Aposta devolvida: ${c.title}`,
        refKey: `chal:${c.id}:back`,
      },
    });
  }

  private async payWinner(tx: Tx, c: Challenge, winnerId: string) {
    await tx.gemTx.createMany({
      data: [
        {
          userId: winnerId,
          amount: c.stake,
          reason: `Aposta devolvida: ${c.title}`,
          refKey: `chal:${c.id}:back`,
        },
        {
          userId: winnerId,
          amount: c.stake,
          reason: `Desafio ganho: ${c.title}`,
          refKey: `chal:${c.id}:prize`,
        },
      ],
    });
  }

  private when(date: Date) {
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async notify(userId: string, msg: { title: string; body: string }) {
    try {
      await this.push.send(userId, {
        ...msg,
        url: '/amigos',
        tag: 'challenge',
      });
    } catch (error) {
      this.logger.warn(`Push de desafio falhou: ${String(error)}`);
    }
  }
}
