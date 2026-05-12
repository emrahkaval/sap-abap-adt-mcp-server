# SAP ABAP Remote FS MCP Server — Claude Code Configuration

This file provides guidance to Claude Code (claude.ai/code) when working with the SAP ABAP Remote File System MCP Server project.

## Project Overview

- **Project name**: SAP ABAP Remote File System MCP Server
- **Project type**: Model Context Protocol (MCP) server for SAP ABAP systems
- **Brief description**: An MCP server that provides access to SAP ABAP objects via ADT (ABAP Development Tools) REST API, enabling AI assistants to browse and read SAP ABAP source code.
- Node.js 14.x | JavaScript
- MCP SDK + Express + Axios
- Transport: Stdio (primary) or HTTP/SSE (optional)

## Key Features

- Connects to SAP systems via ADT REST API
- Lists available ABAP objects (programs, classes, function groups, tables, etc.)
- Reads source code of ABAP objects
- Model Context Protocol compliant
- Environment-based configuration
- Health check endpoints

## Project Structure

```
sap-abap-remotefs-mcp-server/
├── index.js              # Main MCP server implementation
├── package.json          # Project dependencies and scripts
├── README.md             # Documentation
├── .env.example          # Example environment configuration
└── .claude/              # Claude Code settings (if present)
```

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# Copy example environment file and configure
cp .env.example .env
# Edit .env with your SAP connection details
```

### Running the Server
```bash
# Start as stdio MCP server (standard for MCP clients like Claude Code)
npm start

# Start in development mode with auto-restart
npm run dev

# Start with HTTP server enabled (for health checks)
npm start -- --http
```

### Environment Configuration
Create a `.env` file with:
```
SAP_ADT_BASE_URL=https://your-sap-system.com
SAP_CLIENT=100
SAP_USER=your_username
SAP_PASSWORD=your_password
PORT=3000  # Optional
```

## Implementation Details

### Server Architecture
- **MCP Layer**: Uses `@modelcontextprotocol/sdk` for MCP protocol handling
- **Transport**: Primarily uses stdio transport for direct MCP client communication
- **HTTP Layer**: Optional Express server for health checks and demonstration
- **SAP Communication**: Axios-based client for ADT REST API calls
- **Configuration**: Environment variables via `dotenv`

### Key Files
- `index.js`: Contains the `SapAbapMcpServer` class implementing:
  - Resource listing (`listResources`) - browses ABAP object types
  - Resource reading (`readResource`) - fetches source code from SAP ADT
  - ADT object list parsing (`parseAdtObjectList`) - handles XML responses
- `package.json`: Defines dependencies and npm scripts

### ADT API Endpoints Used
- Object listing: `/sap/bc/adt/repository/infometypes/<type>/objects`
- Source retrieval: Varies by object type (programs, classes, tables, etc.)

## Important Notes

### Authentication
- Currently uses basic authentication (username/password)
- For production, consider enhancing with SAP Logon Tickets or other secure methods
- Credentials should never be committed to version transport

### Response Parsing
- The `parseAdtObjectList` method contains simplified XML parsing
- May need adjustment based on your specific SAP system's ADT API version and response formats
- Test with your SAP system to ensure proper object enumeration

### Transport Modes
- **Stdio Transport**: Default, used by most MCP clients (including Claude Code)
- **HTTP/SSE Transport**: Available when started with `--http` flag
- For Claude Code integration, stdio transport is recommended

### Error Handling
- Returns MCP-standard error codes for protocol compliance
- Logs warnings for non-critical issues (e.g., parsing difficulties)
- Continues operation when individual object types fail to list

## Customization

### Adding New Object Types
To support additional ABAP object types:
1. Add entry to `objectTypes` array in `listResources()` method
2. Add corresponding endpoint mapping in `readResource()` method
3. Adjust parsing in `parseAdtObjectList()` if needed for specific response formats

### Enhancing Response Format
- Modify `readResource()` to return more specific MIME types based on object type
- Implement detailed XML parsing for object descriptions and metadata
- Add support for binary objects if needed

## Maintenance

### Updating Dependencies
```bash
npm update
# Test thoroughly after updates, especially MCP SDK changes
```

### Configuration Changes
- Modify `.env` file for connection changes
- No code changes needed for environment variable adjustments

### Debugging
- Check console output for connection and parsing warnings
- Verify SAP ADT accessibility independently
- Test individual API endpoints with tools like curl or Postman

This server enables AI assistants to interact with SAP ABAP systems through a standardized MCP interface, facilitating code exploration, analysis, and development assistance.