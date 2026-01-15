#!/bin/sh
set -e

# Ensure Claude CLI config directory exists with correct permissions
if [ ! -d "/home/automaker/.claude" ]; then
    mkdir -p /home/automaker/.claude
fi

# If CLAUDE_OAUTH_CREDENTIALS is set, write it to the credentials file
# This allows passing OAuth tokens from host (especially macOS where they're in Keychain)
if [ -n "$CLAUDE_OAUTH_CREDENTIALS" ]; then
    echo "$CLAUDE_OAUTH_CREDENTIALS" > /home/automaker/.claude/.credentials.json
    chmod 600 /home/automaker/.claude/.credentials.json
fi

# Fix permissions on Claude CLI config directory
chown -R automaker:automaker /home/automaker/.claude
chmod 700 /home/automaker/.claude

# Ensure Cursor CLI config directory exists with correct permissions
# This handles both: mounted volumes (owned by root) and empty directories
if [ ! -d "/home/automaker/.cursor" ]; then
    mkdir -p /home/automaker/.cursor
fi
chown -R automaker:automaker /home/automaker/.cursor
chmod -R 700 /home/automaker/.cursor

# If CURSOR_AUTH_TOKEN is set, write it to the cursor auth file
# On Linux, cursor-agent uses ~/.config/cursor/auth.json for file-based credential storage
# The env var CURSOR_AUTH_TOKEN is also checked directly by cursor-agent
if [ -n "$CURSOR_AUTH_TOKEN" ]; then
    CURSOR_CONFIG_DIR="/home/automaker/.config/cursor"
    mkdir -p "$CURSOR_CONFIG_DIR"
    # Write auth.json with the access token
    cat > "$CURSOR_CONFIG_DIR/auth.json" << EOF
{
  "accessToken": "$CURSOR_AUTH_TOKEN"
}
EOF
    chmod 600 "$CURSOR_CONFIG_DIR/auth.json"
    chown -R automaker:automaker /home/automaker/.config
fi

# Ensure GitHub CLI config directory has correct permissions
if [ -d "/home/automaker/.config/gh" ]; then
    chown -R automaker:automaker /home/automaker/.config/gh
    chmod 700 /home/automaker/.config/gh
    chmod 600 /home/automaker/.config/gh/* 2>/dev/null || true
fi

# Fix permissions on projects directory (handles files created by root via docker exec)
if [ -d "/projects" ]; then
    chown -R automaker:automaker /projects
fi

# Fix permissions on data directory
if [ -d "/data" ]; then
    chown -R automaker:automaker /data
fi

# Give automaker user access to Docker socket (for deployment commands)
if [ -S "/var/run/docker.sock" ]; then
    # Get the GID of the docker socket
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)

    if [ "$DOCKER_GID" = "0" ]; then
        # On Docker Desktop (Windows/macOS), socket is owned by root
        # Make it accessible to all users
        chmod 666 /var/run/docker.sock 2>/dev/null || true
    else
        # On Linux, create docker group with matching GID if needed
        if ! getent group docker > /dev/null 2>&1; then
            groupadd -g "$DOCKER_GID" docker 2>/dev/null || true
        fi
        # Add automaker user to docker group
        usermod -aG docker automaker 2>/dev/null || true
    fi
fi

# Switch to automaker user and execute the command
exec gosu automaker "$@"
