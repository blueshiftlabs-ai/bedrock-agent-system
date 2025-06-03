import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';

@ApiTags('workflows')
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('code-analysis')
  @ApiOperation({ summary: 'Execute code analysis workflow' })
  @ApiResponse({ status: 201, description: 'Workflow started successfully' })
  async executeCodeAnalysis(@Body() body: { filePath: string }) {
    return await this.workflowService.executeCodeAnalysis(body.filePath);
  }

  @Post(':workflowId/resume')
  @ApiOperation({ summary: 'Resume a paused workflow' })
  @ApiResponse({ status: 200, description: 'Workflow resumed successfully' })
  async resumeWorkflow(
    @Param('workflowId') workflowId: string,
    @Body() body: { workflowType: string }
  ) {
    return await this.workflowService.resumeWorkflow(workflowId, body.workflowType);
  }
}
