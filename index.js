const express = require('express');
const { Server } = require('sse-express');
const { createServer } = require('@modelcontextprotocol/sdk/server/sse.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CreateMessageRequestSchema,
  McpError,
  ErrorCode
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// SAP ADT Configuration
const sapConfig = {
  baseUrl: process.env.SAP_ADT_BASE_URL || '',
  client: process.env.SAP_CLIENT || '100',
  user: process.env.SAP_USER || '',
  password: process.env.SAP_PASSWORD || '',
};

if (!sapConfig.baseUrl || !sapConfig.user || !sapConfig.password) {
  console.warn('WARNING: SAP ADT connection not fully configured. Please set SAP_ADT_BASE_URL, SAP_USER, and SAP_PASSWORD in .env file');
}

// Create an axios instance for SAP ADT
const sapAxios = axios.create({
  baseURL: sapConfig.baseUrl,
  auth: {
    username: sapConfig.user,
    password: sapConfig.password
  },
  headers: {
    'Accept': 'application/xml, text/plain, */*',
    'Content-Type': 'application/xml',
    'X-SAP-Logon-Token': 'true',
    'sap-client': sapConfig.client
  }
});

// MCP Server implementation
class SapAbapMcpServer {
  constructor() {
    this.server = null;
  }

  async initialize() {
    // Create MCP server
    this.server = createServer({
      name: 'sap-abap-remotefs',
      version: '1.0.0'
    }, {
      capabilities: {
        resources: {},
        logging: {}
      }
    });

    // Set up request handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return await this.listResources();
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return await this.readResource(request.params.uri);
    });

    // For stdio transport (most common for MCP)
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('SAP ABAP MCP Server running on stdio');
  }

  async listResources() {
    try {
      // If not configured, return empty list
      if (!sapConfig.baseUrl || !sapConfig.user || !sapConfig.password) {
        return { resources: [] };
      }

      // Define the ABAP object types we want to browse
      const objectTypes = [
        { type: 'PROG/P', name: 'ABAP Programs', endpoint: '/sap/bc/adt/repository/infometypes/prog/objects' },
        { type: 'CLAS/OC', name: 'ABAP Classes', endpoint: '/sap/bc/adt/repository/infometypes/clas/objects' },
        { type: 'FUGR/F', name: 'Function Groups', endpoint: '/sap/bc/adt/repository/infometypes/fugr/objects' },
        { type: 'TABL/DT', name: 'Database Tables', endpoint: '/sap/bc/adt/repository/infometypes/tabd/objects' },
        { type: 'DTEL/DE', name: 'Data Elements', endpoint: '/sap/bc/adt/repository/infometypes/dtel/objects' },
        { type: 'DOMA', name: 'Domains', endpoint: '/sap/bc/adt/repository/infometypes/doma/objects' }
      ];

      const resources = [];

      // Fetch resources for each object type
      for (const objType of objectTypes) {
        try {
          const response = await sapAxios.get(objType.endpoint, {
            // Add parameters if needed for filtering/pagination
          });

          // Parse the response based on object type
          const objects = this.parseAdtObjectList(response.data, objType.type);

          objects.forEach(obj => {
            resources.push({
              uri: `sap-abap://${objType.type}/${encodeURIComponent(obj.name)}`,
              name: `${obj.name} (${objType.name})`,
              description: obj.description || '',
              mimeType: 'text/plain'
            });
          });
        } catch (error) {
          console.warn(`Failed to fetch ${objType.name}:`, error.response?.data || error.message);
          // Continue with other object types
        }
      }

      return {
        resources
      };
    } catch (error) {
      console.error('Error listing resources:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list SAP ABAP resources: ${error.message}`
      );
    }
  }

  async readResource(uri) {
    try {
      // If not configured, throw error
      if (!sapConfig.baseUrl || !sapConfig.user || !sapConfig.password) {
        throw new McpError(
          ErrorCode.InternalError,
          'SAP ADT connection not configured'
        );
      }

      // Parse the URI to determine what to read
      // Expected format: sap-abap://<objectType>/<objectName>
      const match = uri.match(/^sap-abap:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid resource URI: ${uri}`
        );
      }

      const [, objectType, encodedObjectName] = match;
      const objectName = decodeURIComponent(encodedObjectName);

      // Map object type to ADT endpoint
      const endpointMap = {
        'PROG/P': `/sap/bc/adt/programs/programs/${encodeURIComponent(objectName)}/source/main`,
        'CLAS/OC': `/sap/bc/adt/classes/classes/${encodeURIComponent(objectName)}/source/main`,
        'FUGR/F': `/sap/bc/adt/objects/class/${encodeURIComponent(objectName)}`, // Function groups are a bit different
        'TABL/DT': `/sap/bc/adt/tables/table/${encodeURIComponent(objectName)}/source/main`,
        'DTEL/DE': `/sap/bc/adt/data/elements/dataelement/${encodeURIComponent(objectName)}/source/main`,
        'DOMA': `/sap/bc/adt/domains/domain/${encodeURIComponent(objectName)}/source/main`
      };

      const endpoint = endpointMap[objectType];
      if (!endpoint) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unsupported object type: ${objectType}`
        );
      }

      // Fetch the source code from SAP ADT
      const response = await sapAxios.get(endpoint, {
        // We want plain text if possible
        headers: {
          'Accept': 'text/plain, application/xml, */*'
        }
      });

      // The response might be XML or plain text
      let content = response.data;

      // For some object types, SAP returns XML even when we ask for text/plain
      // We'll return it as-is and let the client handle it
      // In a more sophisticated implementation, we'd parse common XML formats

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: content.toString()
          }
        ]
      };
    } catch (error) {
      console.error(`Error reading resource ${uri}:`, error.response?.data || error.message);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read SAP ABAP resource ${uri}: ${error.message}`
      );
    }
  }

  parseAdtObjectList(xmlData, objectType) {
    // Parse the ADT object list response
    // The format varies by object type, but generally contains entry elements

    // Convert XML to text for parsing if it's not already a string
    const xmlText = typeof xmlData === 'string' ? xmlData : String(xmlData);

    // Simple regex-based parsing for common ADT response formats
    // This is a simplified implementation - in production you'd want proper XML parsing

    const objects = [];

    try {
      // Look for common patterns in ADT responses
      // Many ADT responses use <entry> or <adtcore:elements> structures

      // Try to find object names - this varies by object type
      let nameMatches = [];
      let descMatches = [];

      // Pattern 1: Look for <title> or <name> elements (common in Atom feeds)
      if (xmlText.includes('<title>') || xmlText.includes('<name>')) {
        const titleRegex = /<(?:title|name)[^>]*>([^<]+)<\/(?:title|name)>/g;
        let match;
        while ((match = titleRegex.exec(xmlText)) !== null) {
          nameMatches.push(match[1]);
        }
      }

      // Pattern 2: Look for <id> elements that might contain object names
      if (xmlText.includes('<id>')) {
        const idRegex = /<id[^>]*>([^<]+)<\/id>/g;
        let match;
        while ((match = idRegex.exec(xmlText)) !== null) {
          // Extract the last part after slash if it's a URI
          const parts = match[1].split('/');
          const name = parts[parts.length - 1];
          if (name && !nameMatches.includes(name)) {
            nameMatches.push(name);
          }
        }
      }

      // Pattern 3: Look for direct object references in attributes
      const attrRegex = /objectname=["']([^"']+)["']/gi;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(xmlText)) !== null) {
        nameMatches.push(attrMatch[1]);
      }

      // If we found names, create objects
      if (nameMatches.length > 0) {
        // Remove duplicates and filter out empty names
        const uniqueNames = [...new Set(nameMatches.filter(n => n && n.trim()))];

        for (const name of uniqueNames) {
          objects.push({
            name: name.trim(),
            description: '' // Description would require more detailed parsing
          });
        }
      } else {
        // Fallback: try to extract any meaningful text that looks like object names
        // This is very heuristic and object-type dependent
        console.warn(`Could not parse object list for ${objectType} using standard patterns`);

        // For now, return empty array - user should implement proper parsing for their system
        return [];
      }
    } catch (parseError) {
      console.warn(`Error parsing ADT object list for ${objectType}:`, parseError);
      return [];
    }

    return objects;
  }
}

// Start the server when the module is loaded
const server = new SapAbapMcpServer();
server.initialize().catch(console.error);

// Express app for health check and optional HTTP endpoints
app.get('/', (req, res) => {
  res.send('SAP ABAP MCP Server is running');
});

app.get('/health', (req, res) => {
  if (!sapConfig.baseUrl || !sapConfig.user || !sapConfig.password) {
    res.status(503).send('SAP ADT not configured');
  } else {
    res.status(200).send('OK');
  }
});

// Start HTTP server only if we're not in stdio mode
// In most MCP implementations, stdio is used, so we won't listen on HTTP
// But we'll keep the Express app available for health checks if needed
if (process.argv.includes('--http')) {
  const httpServer = app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}