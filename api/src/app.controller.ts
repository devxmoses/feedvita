import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('health')
@Controller()
export class AppController {
  @ApiOperation({ summary: 'Liveness probe'})
  @ApiResponse({ status: 200, description: 'The API is up'})
  // Load balancers and uptime checks poll this far more often than the global
  // rate limit allows, and a throttled health check reads as an outage.
  @SkipThrottle()
  @Get('health')
  health() {
    return {status: 'ok', uptime:process.uptime(), timestamp: new Date().toISOString() };
  }
}
