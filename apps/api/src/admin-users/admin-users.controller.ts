import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RawQuery } from '../admin-common/admin-query.util';
import { AdminUsersService } from './admin-users.service';
import { PlanActionDto, SetRoleDto, UpdateAdminUserDto } from './dto/admin-user.dto';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  list(@Query() query: RawQuery) {
    return this.service.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdminUserDto, @CurrentUser() actor: JwtPayload) {
    return this.service.update(id, dto, actor);
  }

  @Post(':id/plan')
  plan(@Param('id') id: string, @Body() dto: PlanActionDto, @CurrentUser() actor: JwtPayload) {
    return this.service.changePlan(id, dto, actor);
  }

  @Post(':id/role')
  role(@Param('id') id: string, @Body() dto: SetRoleDto, @CurrentUser() actor: JwtPayload) {
    return this.service.setRole(id, dto.role, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.service.remove(id, actor);
  }
}
