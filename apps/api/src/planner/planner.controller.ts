import { Controller, Get, Patch, Body } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { UpsertPlannerDto } from './dto/upsert-planner.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('planner')
export class PlannerController {
  constructor(private readonly service: PlannerService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.service.get(user.clientId, user.sub);
  }

  @Patch()
  upsert(@Body() dto: UpsertPlannerDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsert(dto, user.clientId, user.sub);
  }
}
