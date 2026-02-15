# Meeting Speaking Time Tracker

A web app to track how much each participant speaks during a meeting.

## Features

- **Speaking Time Tracking** - Start/stop timer per participant with one-at-a-time speaking
- **Real-time Stats** - Live percentages, progress bars, and meeting duration
- **Doughnut Chart** - Visual breakdown of speaking time distribution (Chart.js)
- **Meeting History** - Automatically saved to localStorage; review past meetings anytime
- **Responsive** - Works on desktop and mobile

## Usage

Open `index.html` in a browser. No build step or server required.

1. Add participant names
2. Click **Start Meeting**
3. Click **Speak** next to whoever is talking (click **Stop** when they finish)
4. Click **End Meeting** to save the session to history
5. Switch to the **Meeting History** tab to review past meetings
