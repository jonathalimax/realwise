import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; timestamp: string; uptime: number } {
    const uptime = Math.round(process.uptime());
    return { status: 'ok', timestamp: new Date().toISOString(), uptime };
  }
}
