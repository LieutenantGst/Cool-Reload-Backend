# Cool Reload Backend

A self-hosted backend for Fortnite-style profile and matchmaking features, built for local testing and private server setups.

This project is designed to support profile loading, item/shop logic, lobby features, matchmaking, moderation tools, and Discord admin actions.

> This repository is for private/self-hosted use. Please respect Epic and platform terms and use it responsibly.

---

## What this backend includes

- Account/auth flow with token handling
- Fortnite-like profile generation and updates
- Battle pass and XP/profile stat persistence
- Matchmaking session support
- Item shop / catalog handling
- Friend and party-related routes
- Discord moderation commands
- Custom ban durations and matchmaking bans
- Lightweight hosting suitability for local or Chromebook-based dev environments

---

## Current important features

- Profile stats save correctly, including battle pass and progression values
- Matchmaking bans can be set without fully banning the account
- Full account bans still work with custom durations
- Admin `ban` command supports short and long durations such as:
  - `1h`
  - `2d`
  - `1w`
  - `1mo`
  - `1y`
  - `2026-12-31`
- `ban` can target either:
  - `account`
  - `matchmaking`
- `check-user` shows user status and ban details
- `unban` clears the ban state and notifies the user
- Shop and catalog flows are available for item-related gameplay

---

## Requirements

- Node.js 18+
- MongoDB running locally or on a reachable host
- A valid config file in `Config/config.json`
- Optional: Discord bot setup for admin commands

For lightweight setups, this project can be run in a Linux container or dev environment such as a Chromebook with a proper local runtime.

---

## Quick start

1. Install dependencies

   ```bash
   npm install
   ```

2. Make sure MongoDB is running.

3. Configure your environment values in `Config/config.json`.

4. Start the backend

   ```bash
   node index.js
   ```

5. If you are using the Discord admin bot, make sure the bot is configured and started from the project setup.

---

## Main project structure

- `index.js` — backend entrypoint
- `routes/` — API and game route handlers
- `model/` — MongoDB schemas
- `DiscordBot/` — admin and user commands
- `Config/` — config and default profile data
- `responses/` — static game data used by the backend
- `Website/` — web UI pieces
- `structs/` — shared helpers and utilities

---

## Admin commands

Included moderation tools cover:

- `/ban`
- `/unban`
- `/check-user`
- `/create`
- `/appeal`
- `/leaderboard`
- `/buy`
- `/add`
- `/remove`
- `/change-username`

Examples:

```text
/ban username:player duration:1mo type:matchmaking reason:Leaving matches
/ban username:player duration:30d type:account reason:Rule break
/unban username:player
```

---

## Matchmaking ban behavior

When a user is banned with `type:matchmaking`, they can still access the lobby, but they are blocked from joining matchmaking queues.

This is useful for temporary competitive restrictions without fully locking the account out of login and profile access.

---

## Notes

- This project is intended for local/self-hosted backend work.
- It is not a public production-ready service by default.
- Please keep your config secrets private and do not expose your backend to the internet without proper security controls.

---

## License

This project is licensed under the GNU General Public License v3.0.

See the [LICENSE](LICENSE) file for more details.

