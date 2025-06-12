'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

export default function AdminPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>External Database Interfaces</CardTitle>
        <CardDescription>
          Access database administration interfaces
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">DynamoDB Admin</CardTitle>
              <CardDescription>Local DynamoDB interface</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('http://localhost:5101', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open DynamoDB Admin
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">OpenSearch Dashboards</CardTitle>
              <CardDescription>Vector search interface</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('http://localhost:5102/_dashboards', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open OpenSearch
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Neo4j Browser</CardTitle>
              <CardDescription>Knowledge graph interface</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('http://localhost:7474/browser', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Neo4j Browser
              </Button>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}