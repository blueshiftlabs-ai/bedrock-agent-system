import { Module } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { EventAggregatorService } from './services/event-aggregator.service';
import { MessageBrokerService } from './services/message-broker.service';

@Module({
  providers: [
    WebSocketGateway,
    EventAggregatorService,
    MessageBrokerService,
  ],
  exports: [
    WebSocketGateway,
    EventAggregatorService,
    MessageBrokerService,
  ],
})
export class WebSocketModule {}