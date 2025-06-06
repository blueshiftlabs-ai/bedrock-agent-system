import { Controller, Get} from '@nestjs/common';
import { MemoryService } from '../services/memory.service';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get('health')
  async healthCheck(): Promise<any> {
    return this.memoryService.healthCheck();
  }
}