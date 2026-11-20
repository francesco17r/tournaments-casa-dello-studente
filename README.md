# House Tournaments – Casa dello Studente

Website for the foosball, table tennis and chess tournaments for Casa dello Studente residents.

- `index.html`: public site (schedule, groups, brackets, rules)
- `admin.html`: organiser page (sign-ups, draw, results). Saving needs a fine-grained GitHub token with "Contents: Read and write" on this repository; the token stays in the organiser's browser.
- `data/tornei.json`: all tournament data
- `js/engine.js`: groups, standings and knockout logic
- `js/vista.js`: shared rendering

Published with GitHub Pages from the `main` branch.
