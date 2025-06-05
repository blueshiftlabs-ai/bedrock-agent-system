import { Controller, Post, Get, Body, Param, Query, Delete } from '@nestjs/common';
import { MemoryService } from '../services/memory.service';
import {
  StoreMemoryRequest,
  StoreMemoryResponse,
  RetrieveMemoriesRequest,
  RetrieveMemoriesResponse,
  AddConnectionRequest,
  AddConnectionResponse,
  CreateObservationRequest,
  CreateObservationResponse,
  ConsolidateMemoriesRequest,
  ConsolidateMemoriesResponse,
} from '../types/memory.types';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post('store')
  async storeMemory(@Body() request: StoreMemoryRequest): Promise<StoreMemoryResponse> {
    return this.memoryService.storeMemory(request);
  }

  @Post('retrieve')
  async retrieveMemories(@Body() request: RetrieveMemoriesRequest): Promise<RetrieveMemoriesResponse> {
    return this.memoryService.retrieveMemories(request);
  }

  @Post('search')
  async searchMemories(@Body() query: any): Promise<RetrieveMemoriesResponse> {
    return this.memoryService.retrieveMemories({ query });
  }

  @Delete(':memoryId')
  async deleteMemory(@Param('memoryId') memoryId: string): Promise<{ success: boolean }> {
    return this.memoryService.deleteMemory(memoryId);
  }

  @Post('connections')
  async addConnection(@Body() request: AddConnectionRequest): Promise<AddConnectionResponse> {
    return this.memoryService.addConnection(request);
  }

  @Post('observations')
  async createObservation(@Body() request: CreateObservationRequest): Promise<CreateObservationResponse> {
    return this.memoryService.createObservation(request);
  }

  @Post('consolidate')
  async consolidateMemories(@Body() request: ConsolidateMemoriesRequest): Promise<ConsolidateMemoriesResponse> {
    return this.memoryService.consolidateMemories(request);
  }

  @Get('statistics')
  async getMemoryStatistics(@Query('agentId') agentId?: string): Promise<any> {
    return this.memoryService.getMemoryStatistics(agentId);
  }

  @Get('health')
  async healthCheck(): Promise<any> {
    return this.memoryService.healthCheck();
  }
}