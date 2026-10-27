import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { CoachController } from './coach/coach.controller';
import { UserContextService } from './coach/user-context.service';
import { requireEnv } from './common/env';
import { DiaryController } from './diary/diary.controller';
import { DiaryService } from './diary/diary.service';
import { ExamsController } from './exams/exams.controller';
import { ExamsService } from './exams/exams.service';
import { FastingController } from './fasting/fasting.controller';
import { FoodsController } from './foods/foods.controller';
import { ChallengesController } from './friends/challenges.controller';
import { ChallengesService } from './friends/challenges.service';
import { FriendsController } from './friends/friends.controller';
import { SavedMealsController } from './diary/saved-meals.controller';
import { BodyController } from './body/body.controller';
import { ShoppingController } from './shopping/shopping.controller';
import { FriendsService } from './friends/friends.service';
import { GameController } from './game/game.controller';
import { GameService } from './game/game.service';
import { IntegrationsController } from './integrations/integrations.controller';
import { MissionsController } from './missions/missions.controller';
import { PhotosController } from './photos/photos.controller';
import { PhotosService } from './photos/photos.service';
import { PrismaModule } from './prisma/prisma.service';
import { AdaptiveService } from './profile/adaptive.service';
import { ProfileController } from './profile/profile.controller';
import { RoutinesController } from './training/routines.controller';
import { PushController } from './push/push.controller';
import { PushService } from './push/push.service';
import { RemindersService } from './push/reminders.service';
import { RecipesController } from './recipes/recipes.controller';
import { StatsController } from './stats/stats.controller';
import { SupplementsController } from './supplements/supplements.controller';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: requireEnv('JWT_SECRET'),
      signOptions: { expiresIn: '90d' },
    }),
  ],
  controllers: [
    AuthController,
    ProfileController,
    RoutinesController,
    DiaryController,
    FoodsController,
    AiController,
    PhotosController,
    StatsController,
    MissionsController,
    CoachController,
    IntegrationsController,
    FastingController,
    RecipesController,
    GameController,
    SupplementsController,
    FriendsController,
    SavedMealsController,
    BodyController,
    ShoppingController,
    ChallengesController,
    ExamsController,
    PushController,
  ],
  providers: [
    AuthGuard,
    AiService,
    PhotosService,
    DiaryService,
    UserContextService,
    AdaptiveService,
    GameService,
    FriendsService,
    ChallengesService,
    ExamsService,
    PushService,
    RemindersService,
  ],
})
export class AppModule {}
