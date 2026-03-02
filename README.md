# Betaflight MCP

## MCP tool resources

### MSP protocol and implementation
This is how the Betaflight Configurator communicates with the flight controller. Understanding this is key to understanding how to interface and interact with the flight controller, and how to implement the MCP tool.
https://github.com/betaflight/betaflight-configurator/raw/refs/heads/master/src/js/msp/MSPCodes.js
https://github.com/betaflight/betaflight-configurator/raw/refs/heads/master/src/js/msp/MSPConnector.js
https://github.com/betaflight/betaflight-configurator/raw/refs/heads/master/src/js/msp/MSPHelper.js
https://github.com/betaflight/betaflight-configurator/raw/refs/heads/master/src/js/injected_methods.js

### CLI commands and variable configuration reference
This is the command line interface reference for Betaflight, which is used to configure and tune the flight controller programmatically. All the commands and variables that can be set via CLI are documented here, and all should be available as MCP tools including their descriptions and options.
https://github.com/betaflight/betaflight.com/raw/refs/heads/master/docs/development/Cli.md
