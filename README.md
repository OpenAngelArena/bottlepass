# Bottlepass Server
API server for OAA, calculating MMR and giving people fake internet points.

## Installation
`npm i` to install the node dependencies

Copy `.oaaserverrc.example` to `.oaaserverrc` and edit the values to be correct. To test locally against OAA running in tools mode, simply edit the URL override at the top of [bottlepass/server.lua](https://github.com/OpenAngelArena/oaa/blob/master/game/scripts/vscripts/components/bottlepass/server.lua#L12) to point to the IP address where your test Bottlepass server is running.

# MMR System
MMR is hard. No system is perfect, and no system truly works well without matchmaking. This is our system that we built anyway.

Our MMR system is a version of the ELO system, modified to fit the 5v5 format. The basic principle is to predict odds that a team will win, and correct their MMR based on the results. The more favored a team is, the less they gain on a win and the more they lose on a defeat. Conversely, the projected loser doesn't lose as much, and will get a large MMR jump on an upset.

The amount of MMR distributed to each player is based on a few things. First, both teams' odds, as measured by their K values, determine how much MMR is at stake (as detailed below). Then, each player's MMR outcome is based on their current MMR compared to their teammates' value; high MMR players in lower tier teams have less at stake. Even games with even teams (such as organized scrims) have the greatest MMR movement.

## ELO and K values
ELO revolves around a predictive function that, given two competing scores, gives the expected probability the first score wins. When a match is completed, the expected and actual (0 on a loss, 1 on a win) outcomes are compared. The difference between them is then multiplied by the "K value" of the participant to obtain the MMR change (note that, for the loser, that will be a negative number).

The K value is essentially the rate at which one moves through the rankings. Our K value system is taken from chess, where there's a large K value for lower MMR players then it scales downwards until "master" level, where it hits the lowest value and stops changing. This makes it easier for a player to reach their actual skill level, whereupon they stabilize.

These are the current K-values, per MMR bracket (do note these are subject to change, as we tune the system):

| MMR Range | K value |
| -------- | -------- |
| below 500 | 80 |
| between 500 and 1000 | 40 |
| between 1000 and 2000 | linear 40 to 20 |
| 2000 or above | 20 |

The ELO function is `1 / (1 + Math.pow(10, (score1 - score0) / 400))`
In LaTeX: `10^{-\frac{\mathrm{YourScore}-\mathrm{TheirScore}}{400}}`
Scores are multiplied by 2 to make up for the additional pass through the ELO function
