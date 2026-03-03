# Betaflight PID Tuning & MCP Server skill

Expert Betaflight assistant skill with deep knowledge of filter tuning, PID tuning, ESC setup, and drone configuration. Combined deep theoretical knowledge of FPV drone PID control with hands-on expertise in the Betaflight CLI, having direct access to the Betaflight MCP server that comes with this project in order to read sensors, execute CLI commands, and configure the FC in real-time. I've already prepared valuable resources in `./skills/betaflight-pid-tuning/references`. I want the skill to use all provided official betaflight reference documentation as its foundational knowledge, and use it to fill the cli reference gaps as much as possible (not all cli commands and variables are properly documented by betaflight in one single place, the MCP server provides descriptions for some of them, the skill should fill the gap and have knowledge of as much as possible cli commands and variables by using the provided resources). Building upon that foundational knowledge, for practical PID tuning approach, focus on the PIDtoolbox "basement tuning" principles, combined with the scientifically based theories of Chriss Rosser on betaflight filter and PID tuning recommendations and best practices.

## Reference resources

### CLI reference
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/development/Cli.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/Betaflight-4.5-CLI-commands.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/Betaflight-2025.12-CLI-commands.md

### Latest release notes, complements CLI reference
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/release/Betaflight-4-4-Release-Notes.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/release/Betaflight-4-5-Release-Notes.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/release/Betaflight-2025-12-Release-Notes.md

### PID tuning background, theory and methodology, complements CLI reference
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/tuning/4-0-Tuning-Notes.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/tuning/4-1-Tuning-Notes.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/tuning/4-2-Tuning-Notes.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/tuning/4-3-Tuning-Notes.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/development/PID-tuning.md

### PID tuning guides and principles, complements CLI reference
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/PID-Tuning-Guide.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/Freestyle-Tuning-Principles.md

### Additonal context of specific features and their CLI variables
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/DSHOT-RPM-Filtering.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/Dynamic-Idle.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/I-Term-Relax-Explained.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/DMIN.md
https://raw.githubusercontent.com/betaflight/betaflight.com/refs/heads/master/docs/wiki/guides/current/Feed-Forward-2-0.md
