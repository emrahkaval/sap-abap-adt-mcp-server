# SAP ABAP ADT MCP Server

An MCP (Model Context Protocol) server that provides access to SAP ABAP objects via the ADT (ABAP Development Tools) REST API. This server allows AI assistants to browse and read SAP ABAP objects like programs, classes, function groups, and more through a standardized interface.

## Features

- Browse available SAP ABAP objects using ADT repository infometypes
- Read source code of ABAP objects via standard ADT endpoints
- Connects to SAP systems via ADT REST API
- Model Context Protocol compliant for use with AI assistants

## Prerequisites

- Node.js >= 14.x
- Access to an SAP system with ADT REST API enabled
- SAP user credentials with appropriate permissions

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your SAP connection details:
   ```env
   SAP_ADT_BASE_URL=https://your-sap-system.com
   SAP_CLIENT=100
   SAP_USER=your_username
   SAP_PASSWORD=your_password
   PORT=3000  # Optional, defaults to 3000
   ```

## Usage

### As a stdio MCP Server (recommended for most AI assistants)

```bash
node index.js
```

The server will communicate via stdio, which is the standard way for MCP servers to connect to AI assistants like Claude Code.

### As an HTTP SSE Server

If you need to expose the server over HTTP (for example, for remote access):

```bash
node index.js
```

Then connect to `http://localhost:3000/sse` for the MCP SSE endpoint.

The server also provides:
- `GET /` - Simple status message
- `GET /health` - Health check endpoint

## Available Resources

The server exposes SAP ABAP objects as MCP resources with URIs in the format:
`sap-abap://<objectType>/<objectName>`

Where `<objectType>` can be:
- `PROG/P` - ABAP Programs
- `CLAS/OC` - ABAP Classes
- `FUGR/F` - Function Groups
- `TABL/DT` - Database Tables
- `DTEL/DE` - Data Elements
- `DOMA` - Domains

## Development

### Project Structure

- `index.js` - Main server implementation
- `package.json` - Project dependencies and scripts

### Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for server implementation
- `express` - Web framework for HTTP endpoints
- `sse-express` - SSE middleware for Express
- `axios` - HTTP client for SAP ADT API calls
- `dotenv` - Environment variable loading

### Development Scripts

- `npm start` - Start the server in production mode
- `npm run dev` - Start the server with nodemon for development

## Configuration

The server can be configured via environment variables:

- `SAP_ADT_BASE_URL` - Base URL of your SAP ADT REST API (required)
- `SAP_CLIENT` - SAP client number (default: "100")
- `SAP_USER` - SAP username for authentication (required)
- `SAP_PASSWORD` - SAP password for authentication (required)
- `PORT` - Port for HTTP server (optional, default: 3000)

## Notes

### Authentication

This implementation uses basic authentication with username/password. Depending on your SAP system's configuration, you may need to adjust the authentication method. The SAP ADT API supports various authentication mechanisms including:

- Basic Authentication (used in this implementation)
- SAP Logon Tickets
- SAML/OAuth (requires additional configuration)

### ADT API Response Parsing

The current implementation includes a placeholder for parsing ADT object list responses (`parseAdtObjectList` method). You will need to implement this method based on your specific SAP system's ADT API version and the object types you want to browse.

The ADT API returns XML responses that vary by object type. You may need to:
1. Inspect the actual XML responses from your SAP system
2. Implement proper XML parsing for each object type
3. Extract the object names and descriptions from the XML

## Troubleshooting

1. **Connection Issues**: Verify your SAP ADT base URL is correct and accessible
2. **Authentication Errors**: Check your SAP user credentials and permissions
3. **Object Listing Problems**: The `parseAdtObjectList` method needs to be implemented for your specific SAP system
4. **CORS Issues**: If accessing via HTTP from a browser, you may need to configure CORS on your Express app

## Security Considerations

- Never commit your `.env` file with SAP credentials to version control
- Consider using more secure authentication methods for production use
- Restrict network access to the MCP server as needed
- Regularly rotate SAP credentials used by the MCP server

## License

MIT