module.exports = function(websiteApp) {
    const express = require("express");
    const path = require("path");
    const config = require("../Config/config.json");
    const User = require("../model/user.js");
    const UserStats = require("../model/userstats.js");
    const log = require("../structs/log.js");

    const DISCORD_API_URL = 'https://discord.com/api';
    const CLIENT_ID = config.Website.clientId;
    const CLIENT_SECRET = config.Website.clientSecret;
    const REDIRECT_URI = config.Website.redirectUri.replace("${websiteport}", config.Website.websiteport);

    websiteApp.use(express.json());
    websiteApp.use(express.urlencoded({ extended: true }));
    
    websiteApp.use('/Images', express.static(path.join(__dirname, './Data/Images')));
    websiteApp.use('/css', express.static(path.join(__dirname, './Data/css')));
    websiteApp.use('/html', express.static(path.join(__dirname, './Data/html')));

    websiteApp.get('/', (req, res) => {
        res.redirect('/login');
    });

    websiteApp.get('/login', (req, res) => {
        const authURL = `${DISCORD_API_URL}/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;

        res.redirect(authURL);
    });

    const oauthCallback = require('./Data/js/oauthCallback')(DISCORD_API_URL, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    websiteApp.get('/oauth2/callback', oauthCallback);

    websiteApp.post('/register-user', require('./Data/js/registerUser.js'));

    websiteApp.get('/register', (req, res) => {
        res.sendFile(path.join(__dirname, './Data/html/register.html'));
    });

    websiteApp.get('/account-exists', (req, res) => {
        res.sendFile(path.join(__dirname, './Data/html/accountExists.html'));
    });

    websiteApp.get('/leaderboard', (req, res) => {
        res.sendFile(path.join(__dirname, './Data/html/leaderboard.html'));
    });

    websiteApp.get('/admin', (req, res) => {
        res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reload Backend Admin</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; }
    .wrap { max-width: 1100px; margin: 32px auto; padding: 16px; }
    h1 { margin-bottom: 24px; }
    .meta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; border-bottom: 1px solid #334155; text-align: left; }
    th { color: #93c5fd; }
    .status { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; }
    .status.banned { background: rgba(239,68,68,0.2); color: #fca5a5; }
    .status.ok { background: rgba(34,197,94,0.2); color: #86efac; }
    .controls { display: flex; gap: 12px; align-items: center; margin: 12px 0 18px; }
    input { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0b1220; color: white; }
    button { padding: 10px 14px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Reload Backend Admin</h1>
    <div class="meta">
      <div class="card"><strong>Users:</strong> <span id="userCount">0</span></div>
      <div class="card"><strong>Banned:</strong> <span id="bannedCount">0</span></div>
      <div class="card"><strong>Matchmaking Banned:</strong> <span id="mmBannedCount">0</span></div>
    </div>
    <div class="controls">
      <input id="apiKeyInput" type="password" placeholder="API key" />
      <button onclick="loadUsers()">Refresh</button>
    </div>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Account ID</th>
            <th>Status</th>
            <th>Ban Type</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody id="userTable"></tbody>
      </table>
    </div>
  </div>

  <script>
    async function loadUsers() {
      const key = document.getElementById('apiKeyInput').value;
      const res = await fetch('/api/admin/users?apiKey=' + encodeURIComponent(key));
      const data = await res.json();
      if (!Array.isArray(data)) {
        alert(data.error || 'Unable to load users');
        return;
      }

      const tbody = document.getElementById('userTable');
      tbody.innerHTML = '';
      let banned = 0;
      let mmBanned = 0;

      data.forEach((user) => {
        const row = document.createElement('tr');
        const status = user.banned || user.matchmakingBanned ? 'banned' : 'ok';
        const label = user.banned ? 'Account' : user.matchmakingBanned ? 'Matchmaking' : 'Active';
        const expires = user.banned ? (user.bannedUntil || user.banExpires || 'Permanent') : (user.matchmakingBanned ? (user.matchmakingBanUntil || 'Permanent') : 'N/A');
        if (user.banned) banned++;
        if (user.matchmakingBanned) mmBanned++;

        row.innerHTML = '<td>' + (user.username || 'Unknown') + '</td>' +
          '<td>' + (user.accountId || 'N/A') + '</td>' +
          '<td><span class="status ' + status + '">' + label + '</span></td>' +
          '<td>' + (user.banned ? 'Account' : user.matchmakingBanned ? 'Matchmaking' : 'None') + '</td>' +
          '<td>' + expires + '</td>';
        tbody.appendChild(row);
      });

      document.getElementById('userCount').textContent = data.length;
      document.getElementById('bannedCount').textContent = banned;
      document.getElementById('mmBannedCount').textContent = mmBanned;
    }
    loadUsers();
  </script>
</body>
</html>`);
    });

    websiteApp.get('/api/admin/users', async (req, res) => {
        const apiKey = req.query.apiKey || req.headers['x-api-key'];
        const config = require('../Config/config.json');
        if (!config.Api || !config.Api.bApiKey || apiKey !== config.Api.bApiKey) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const User = require('../model/user.js');
            const users = await User.find({}).select('username accountId banned bannedUntil banExpires matchmakingBanned matchmakingBanUntil').lean();
            res.json(users.map(user => ({
                username: user.username,
                accountId: user.accountId,
                banned: Boolean(user.banned),
                bannedUntil: user.bannedUntil || user.banExpires || null,
                matchmakingBanned: Boolean(user.matchmakingBanned),
                matchmakingBanUntil: user.matchmakingBanUntil || null,
            })));
        } catch (err) {
            res.status(500).json({ error: 'Failed to load users' });
        }
    });

    websiteApp.get('/api/website/leaderboard', async (req, res) => {
        try {
            const playlist = req.query.playlist || "solo";
            const typeStat = req.query.type || "placetop1";
            const region = req.query.region || "Global";
            const limit = parseInt(req.query.limit) || 50;
            const search = req.query.search ? req.query.search.toLowerCase() : null;

            const allUsers = await User.find({ isServer: false });
            const leaderboardEntries = [];

            for (const user of allUsers) {
                const stat = await UserStats.findOne({ accountId: user.accountId });
                
                const playlistStats = stat ? stat[playlist] : null;
                const value = playlistStats ? (playlistStats[typeStat] || 0) : 0;
                
                
                if (region !== "Global" && region !== "NA" && region !== "EU" && region !== "ASIA") {
                }

                leaderboardEntries.push({
                    rank: 0,
                    accountId: user.accountId,
                    username: user.username,
                    value: value,
                    kills: playlistStats ? (playlistStats.kills || 0) : 0,
                    wins: playlistStats ? (playlistStats.placetop1 || 0) : 0,
                    matches: playlistStats ? (playlistStats.matchesplayed || 0) : 0
                });
            }

            leaderboardEntries.sort((a, b) => b.value - a.value);
            
            
            leaderboardEntries.forEach((entry, index) => {
                entry.rank = index + 1;
            });

            if (search) {
                const searchResult = leaderboardEntries.find(e => e.username.toLowerCase().includes(search));
                return res.json(searchResult ? [searchResult] : []);
            }

            res.json(leaderboardEntries.slice(0, limit));
        } catch (err) {
            log.error("Website Leaderboard API Error:", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });
};
