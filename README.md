# Math Quiz Game

A local-network, touch-friendly mathematics quiz for one shared touch screen (a tablet, phone or touch laptop). Static HTML/CSS/JavaScript served by Nginx in Docker; no database or internet connection is required during play.

## Requirements
- Docker Desktop (Windows/macOS/Linux) with Docker Compose
- Laptop and tablet/phone connected to the same home Wi-Fi/LAN

## Start
1. Extract this folder on your laptop.
2. Open a terminal/PowerShell in this folder.
3. Run:

   ```sh
   docker compose up -d
   ```

4. Find your laptop's LAN IPv4 address:
   - Windows: run `ipconfig` and find the IPv4 address for the active Wi-Fi/Ethernet adapter.
   - macOS/Linux: use your network settings or `ip addr`.
5. On the tablet or phone, open a browser and visit `http://LAPTOP-IP:8080`, e.g. `http://192.168.1.100:8080`.

## Stop / restart
- Stop: `docker compose down`
- Start again: `docker compose up -d`
- View logs: `docker compose logs`

## Firewall and network troubleshooting
- Allow Docker Desktop / inbound TCP port 8080 on your laptop's private/home network.
- Ensure the tablet/phone and laptop are on the same network, not a guest Wi-Fi network with client isolation.
- Do not configure router port forwarding; the game is intended for home-network use only.
- If the laptop sleeps or shuts down, the game will be unavailable.
- To make the address stable, reserve the laptop's IP in your router's DHCP settings.

## Gameplay
- Select Solo or 1 vs 1.
- Each player selects a difficulty independently.
- Tap Start Game. In 1 vs 1, each player has their own answer panel.
- A correct answer awards one point and immediately advances to the next round after a brief result display.
- Solo: a wrong answer is marked and the player can try again.
- 1 vs 1: a wrong answer locks that player out for the current question. If both players answer wrongly, nobody scores and the game moves to the next question.
- Answers respond to the first touch immediately (pointer events), so both players can tap at almost the same moment.
- Levels: Age 2–3 (count up to 5 objects in a row of 5), Age 4 (count up to 10 objects in rows of 5), Age 5 (making 10, e.g. 3 + ? = 10), Age 6 (addition with sums up to 10 and subtraction starting from up to 10), then Grade 1 through Grade 6.
- Age 5 and Age 6 show the first number of the equation as objects above it. Choosing the correct answer adds objects of a different type (for 3 + ? = 10, seven more) or removes objects (10 − 1 removes one). The object area always keeps the same height, so the answers never move.
- Phones held sideways: the header (scores, round, Stop Game, countdown) becomes one slim row, and each player's board shows the question or objects on the left and every answer on the right, so nothing needs scrolling in Solo or 1 vs 1.
- Game length: Endless (default, play until Stop Game) or Timed (choose 30 s, 60 s (default), 90 s, 2, 3 or 5 minutes). A timed game ends automatically when the countdown reaches zero and shows the summary.
- Use Stop Game to end the game and see the final score, the percentage of tapped answers that were correct, and the average time to answer (from the question appearing to the player's first answer). Start a new game to reset scores.

## Topics (Grade 1 to Grade 6 only)
Under each Grade level a Topic can be chosen. The age levels (2–3 to 6) do not have topics. Only topics that suit the grade are offered:

| Topic | Grades | What it asks |
|---|---|---|
| Mixed arithmetic, Addition only, Subtraction only | 1–6 | + and − (Grade 1), plus × and ÷ from Grade 2 |
| Mixed All Questions (first option and the default for new players) | 1–6 | a random mix of every category the grade offers: arithmetic (+ − × ÷), times tables, comparing, fractions, money, clock, shapes |
| Multiplication only, Division only | 2–6 | |
| Times tables | 2–4 | × and ÷ facts, e.g. 7 × ? = 56 (Grade 2: tables of 2, 5, 10; Grade 4: up to 12 × 12) |
| Comparing numbers | 1–4 | choose <, = or > (0–20, up to 99, 999, 9999) |
| Fractions | 1–6 | half of a number, 1/4 of 20, comparing, equivalent, add/subtract, multiply/divide (answers in simplest form) |
| Money | 1–4 | coins, change and totals, answered in cents |
| Clock reading | 1–4 | an analogue clock (o'clock/half past, quarter hours, 5 minutes, any minute) |
| Shapes & measures | 1–6 | sides and corners, faces/edges/vertices, angles, perimeter, area |

Answers are listed smallest to largest (fractions and times by value). Choices such as < = > keep a fixed order.

## Rewards
- Streaks: a 🔥 badge appears from 2 correct answers in a row. At 3, 5, 10 and every 5 after that there is confetti and a new sticker. In 1 vs 1, winning a round also ends the other player's streak. Streaks never change the score, so 1 vs 1 stays fair.
- Stars: the result screen gives ⭐ for accuracy (3 stars for 90% or more, 2 for 70% or more, otherwise 1).
- Trophies: Bronze (questions completed), Silver (questions answered correctly) and Gold (correct answers in a row) for every level, with targets that grow from Age 2–3 to Grade 6. Only a question's first answer counts, so retrying cannot inflate progress; in 1 vs 1 each player is credited separately. Progress is kept per saved profile and level (and included in backups). Open 🏆 Achievements to see them. Targets are set in `public/trophies.js`.
- Stickers: 100 collectable stickers. A saved profile keeps them in its sticker book; guests see what they won for that game only.
- Confetti is skipped when the device asks for reduced motion.

## Profiles
- Open 👤 Profiles to add up to 8 profiles (name and picture). Each player picks "Who is playing?" before starting, or plays as a Guest.
- A profile remembers its last level and topic, totals, best streak, stickers, best timed scores (per level, topic and duration) and its 30 most recent games. A "New personal best" badge appears on timed games.
- Profiles are stored in the browser's local storage on that device, browser and web address only (not on the server), so use the same tablet/browser each time. Clearing browser data removes them, and iPhone/iPad Safari can clear storage for sites not visited for a while.
- **Backup and restore** (in the Profiles window): export to a file or copy the backup text, import by choosing a file or pasting text (check first, then add or replace), and undo the last import. Use this to move profiles to another device, browser or web address. Two players cannot choose the same profile.

## Install and offline play
Over **https://** (or `localhost`) the game installs like an app and keeps working offline after the first load: on Android/desktop Chrome use Settings → Install (or the browser's install option); on iPhone/iPad use Share → Add to Home Screen. New versions are picked up automatically when online, and a "new version is ready" notice offers a reload. On a plain `http://` home-network address (e.g. the Docker setup) the game works normally but cannot be installed or cached for offline use. An installed iPhone/iPad app has its own storage, separate from Safari, so move profiles with Backup and restore. Developers: when files are added, renamed or removed, update `FILES` and bump `VERSION` in `public/sw.js`.

## Settings
Open ⚙️ Settings for:
- Colours: Standard or Colour-blind friendly (blue/orange players, blue-green and vermillion for right/wrong, plus ✓ and ✗ marks).
- Text size: Normal, Large or Extra large. On very short landscape phone screens the biggest sizes are capped slightly so every answer still fits.

## Screen-time bank
Saved profiles playing **Grade 1–6** earn screen-time minutes (Age 2–3 to Age 6 levels and guests do not). Open ⏱ Screen time to see each profile's available, earned and redeemed minutes, progress to the next reward, and recent history; a parent redeems minutes by hand (two taps). Minutes are only tracked: the game cannot restrict screen time on a device.
- Only the **first** answer to a question counts, so retrying cannot raise the score used for rewards.
- Rewards are paid per batch of at least 20 completed questions in one grade (smaller sessions carry forward; grades are never mixed). A batch needs at least 80% right on the first try. Minutes = correct answers × 0.1 × accuracy bonus (80%: ×1.0, 90%: ×1.2, 95%: ×1.4, 100%: ×1.5) × grade bonus (Grade 1 ×1.0 up to Grade 6 ×1.5), rounded down once per batch.
- Parent settings (in the same window) change all of these numbers. Balances, history and settings are saved with the profiles and included in Backup and restore.

## Questions
All questions are generated automatically in the browser. There are no question JSON files, database, API calls or internet dependency. A fresh bank of 500 questions is generated for each selected level and topic when the game starts. Number ranges and complexity increase from Grade 1 through Grade 6. From Grade 4 upward, arithmetic questions always include a wrong option that shares its last digit with the correct answer, so answers can't be guessed from the last digit alone. Division questions are constructed to have exact answers at school levels.

## Files
`public/questions.js` (question generators), `public/store.js` (saved profiles and settings), `public/menus.js` (Settings and Profiles windows), `public/game.js` (game flow, rewards), `public/style.css`, `public/index.html`.

## For developers and AI assistants
Start with `AGENTS.md` (project overview, rules that must not be broken, file map). Details are in `docs/` (architecture, question rules, UI/layout, testing, owner requirements). Tests: `npm install` then `npm test` (GitHub Actions runs the same on every push and pull request) (question validation, UI flow, and layout checks in headless Chromium).
