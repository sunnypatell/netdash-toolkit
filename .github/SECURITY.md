# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please use one of these methods:

1. **GitHub Security Advisories (Preferred)**
   - Go to [Security Advisories](https://github.com/sunnypatell/netdash-toolkit/security/advisories/new)
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email**
   - Send details to: sunnypatel124555@gmail.com
   - Subject: `[SECURITY] NetDash Toolkit Vulnerability Report`
   - Use PGP encryption if possible (key available upon request)

### What to Include

Please provide as much information as possible:

- **Description**: Clear description of the vulnerability
- **Impact**: What an attacker could achieve
- **Affected Components**: Which tools or features are affected
- **Reproduction Steps**: Step-by-step instructions to reproduce
- **Proof of Concept**: Code, screenshots, or recordings if applicable
- **Suggested Fix**: If you have recommendations for fixing the issue
- **Your Contact**: How we can reach you for follow-up questions

### What to Expect

| Timeline | Action                                             |
| -------- | -------------------------------------------------- |
| 24 hours | Initial acknowledgment of your report              |
| 72 hours | Preliminary assessment and severity rating         |
| 7 days   | Detailed response with remediation plan            |
| 30 days  | Target for fix deployment (critical issues faster) |

### Severity Ratings

We use the following severity classifications:

| Severity     | Description                                               | Response Time |
| ------------ | --------------------------------------------------------- | ------------- |
| **Critical** | Remote code execution, data breach, authentication bypass | < 24 hours    |
| **High**     | Privilege escalation, significant data exposure           | < 72 hours    |
| **Medium**   | Limited data exposure, denial of service                  | < 7 days      |
| **Low**      | Minor issues, theoretical vulnerabilities                 | < 30 days     |

### Safe Harbor

We support responsible security research. If you:

- Act in good faith to avoid privacy violations, data destruction, and service disruption
- Only interact with accounts you own or have explicit permission to test
- Report vulnerabilities promptly and don't exploit them beyond proof of concept
- Give us reasonable time to address the issue before public disclosure

We commit to:

- Not pursue legal action against you for your research
- Work with you to understand and resolve the issue
- Credit you in our security acknowledgments (if desired)
- Keep you informed about the fix progress

### Scope

#### In Scope

- NetDash Toolkit desktop application (all platforms)
- NetDash Toolkit web application
- All network tools (ping, traceroute, port scanner, DNS, etc.)
- IPC communication between renderer and main process
- Data storage and handling
- Authentication and authorization (if applicable)

#### Out of Scope

- Third-party dependencies (report to respective maintainers)
- Social engineering attacks
- Physical security
- Denial of service attacks that require significant resources
- Issues in outdated/unsupported versions

### Security Best Practices for Users

1. **Keep Updated**: Always use the latest version of NetDash Toolkit
2. **Download from Official Sources**: Only download from GitHub releases or the official website
3. **Verify Checksums**: Verify download integrity when available
4. **Network Permissions**: Be aware that network tools require certain system permissions
5. **Sensitive Data**: Avoid scanning networks you don't have permission to scan

### Security Features

NetDash Toolkit implements several security measures:

- **Input Validation**: All user inputs are validated and sanitized
- **Command Injection Prevention**: Network commands use parameterized execution
- **No Telemetry**: No data is collected or sent to external servers
- **Local Processing**: All network operations are performed locally
- **Sandboxed Execution**: Electron app follows security best practices

### Acknowledgments

We appreciate the security researchers who help keep NetDash Toolkit secure:

<!-- Security researchers will be acknowledged here -->

_No vulnerabilities reported yet. Be the first!_

---

Thank you for helping keep NetDash Toolkit and its users safe!
