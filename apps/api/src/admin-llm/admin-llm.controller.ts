import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RawQuery } from '../admin-common/admin-query.util';
import { AdminLlmService } from './admin-llm.service';

@Controller('admin/llm-logs')
@UseGuards(AdminGuard)
export class AdminLlmController {
  constructor(private readonly service: AdminLlmService) {}

  @Get()
  list(@Query() query: RawQuery) {
    return this.service.list(query);
  }

  @Get('summary')
  summary(@Query() query: RawQuery) {
    return this.service.summary(query);
  }

  @Get('export.csv')
  async exportCsv(@Query() query: RawQuery, @Res() res: Response) {
    // Filters are validated (400) before the first chunk, so headers are only set once data is flowing.
    let started = false;
    await this.service.exportCsv(query, (chunk) => {
      if (!started) {
        started = true;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="llm-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
      }
      res.write(chunk);
    });
    res.end();
  }
}
