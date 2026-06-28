import { Body, Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CategorizationRulesService } from './categorization-rules.service';
import { CreateCategorizationRuleDto, UpdateCategorizationRuleDto } from './dto/create-categorization-rule.dto';

@Controller('categorization-rules')
export class CategorizationRulesController {
  constructor(private readonly service: CategorizationRulesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.clientId, user.sub);
  }

  @Post()
  create(@Body() dto: CreateCategorizationRuleDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.clientId, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategorizationRuleDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.clientId, user.sub);
  }

  @Post(':id/record-usage')
  recordUsage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.recordUsage(id, user.clientId, user.sub);
  }
}
