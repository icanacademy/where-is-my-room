# Where Is My Room - ICAN Academy

A **real-time classroom locator and room finder display** for ICAN Academy. Shows current room assignments from the scheduling app on a TV display.

## Features

- **🗺️ Live Room Display** - See who's in which room RIGHT NOW
- **📍 Real-time Updates** - Auto-refresh every 10 seconds
- **🏫 Current Time Slot** - Automatically shows current class period
- **👨‍🏫 Teacher Display** - Shows teachers with SUB badges for substitutes
- **👨‍🎓 Student Display** - Shows students assigned to each room
- **🎨 Beautiful UI** - Space-themed glass-morphism design
- **📊 Live Widgets** - Clock, weather, quotes, and more
- **🔄 Read-Only** - Reads from scheduling app database without modifications

## How It Works

```
┌─────────────────────────────┐
│  ICAN Scheduling App        │
│  (Port 5555)                │
│  • Schedule classes         │
│  • Assign teachers/students │
│  • Manage rooms             │
└─────────────────────────────┘
              │
              │ Reads from (PostgreSQL)
              ▼
┌─────────────────────────────┐
│  scheduling_db              │
│  • assignments table        │
│  • teachers table           │
│  • students table           │
│  • rooms table              │
└─────────────────────────────┘
              │
              │ Queries (READ-ONLY)
              ▼
┌─────────────────────────────┐
│  Where Is My Room           │
│  (Port 5557)                │
│  • Shows current time slot  │
│  • Displays room cards      │
│  • Auto-refreshes           │
└─────────────────────────────┘
```

## Quick Start

### Option 1: Double-Click

Simply double-click:
```
Start Where Is My Room.command
```

### Option 2: Command Line

```bash
cd /Users/icanacademy/where-is-my-room
./start.sh
```

This will:
1. Start the server on port 5557
2. Open the display in your browser
3. Auto-refresh every 10 seconds

## Prerequisites

- **Scheduling App Database** must be running
- PostgreSQL database: `scheduling_db`
- Database user: `icanacademy`
- Database must have assignments for today

## What You'll See

### During Class Hours (8AM-9PM)
- **Room cards** showing:
  - Room number (e.g., "Room 5")
  - Teachers (blue badges, yellow for substitutes)
  - Students (green badges with names)
  - Student count

### Outside Class Hours
- Message: "No Classes Right Now"
- Shows current time and class hours

### No Assignments
- Message: "No Room Assignments"
- Means no classes scheduled for current time slot

## Configuration

### Change Server Port

Edit `server/.env`:
```env
PORT=5557
```

### Change Database Connection

Edit `server/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scheduling_db
DB_USER=icanacademy
DB_PASSWORD=
```

### Change Refresh Interval

Edit `client/app.js`:
```javascript
const REFRESH_INTERVAL = 10000; // milliseconds (10 seconds)
```

## API Endpoints

### Core Endpoints
- `GET /api/health` - Server and database status
- `GET /api/current-timeslot` - Get current time slot info
- `GET /api/room-assignments` - Get assignments for current time slot
- `GET /api/today-schedule` - Get all assignments for today

### Data Endpoints
- `GET /api/rooms` - List all rooms
- `GET /api/timeslots` - List all time slots
- `GET /api/search?q=name` - Search for teacher/student

### Query Parameters
- `date` - Specific date (YYYY-MM-DD), defaults to today
- `timeSlotId` - Specific time slot (1-12), defaults to current

## Time Slot Mapping

- **1** = 8AM-9AM
- **2** = 9AM-10AM
- **3** = 10AM-11AM
- **4** = 11AM-12PM
- **5** = 1PM-2PM
- **6** = 2PM-3PM
- **7** = 3PM-4PM
- **8** = 4PM-5PM
- **9** = 5PM-6PM
- **10** = 6PM-7PM
- **11** = 7PM-8PM
- **12** = 8PM-9PM

*Note: 12PM-1PM is lunch break (no time slot)*

## Technology Stack

**Backend:**
- Node.js + Express 5
- PostgreSQL (via pg driver)
- CORS enabled
- READ-ONLY database access

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- CSS Grid layout
- Fetch API for data loading
- Auto-refresh with setInterval
- Space-themed glassmorphism design

## File Structure

```
where-is-my-room/
├── server/
│   ├── server.js           # Express API server (port 5557)
│   ├── db.js               # PostgreSQL connection (read-only)
│   ├── package.json        # Dependencies
│   └── .env                # Configuration
├── client/
│   ├── index.html          # Main display page
│   ├── style.css           # Styles with room card designs
│   ├── app.js              # Frontend logic with room display
│   └── space-background.jpg # Background image
├── start.sh                # Startup script
├── Start Where Is My Room.command  # macOS launcher
└── README.md               # This file
```

## Display Features

### Left Panel - Widgets
- ⏰ Clock with "Where Is My Room?" title
- 🌤️ Weather widget with UV index
- 📚 Word of the Day
- 🤖 AI Mascot with helpful messages
- 💭 Daily inspirational quotes
- 📱 QR Code to ICAN website

### Main Panel - Room Assignments
- **Room Cards** arranged in grid
- Each card shows:
  - Room number (large, prominent)
  - Teachers section with names
  - Students section with count
  - SUB badges for substitute teachers
  - Color-coded tags (blue=teacher, green=student, yellow=sub)

## Troubleshooting

### Problem: "Connection failed" error

**Solution:** Make sure the scheduling app database is running:
```bash
# Check if PostgreSQL is running
psql -U icanacademy -d scheduling_db -c "SELECT NOW();"
```

### Problem: "No Room Assignments" always shows

**Solution:**
1. Check if scheduling app has assignments for today
2. Verify you're within class hours (8AM-9PM)
3. Check server logs for errors

### Problem: Page shows old data

**Solution:**
- The page auto-refreshes every 10 seconds
- If you want immediate update, refresh browser (Cmd+R / F5)

## For TV Display

1. Open the page in any browser
2. Press **F11** for full screen (Cmd+Ctrl+F on Mac)
3. Drag to your TV/external monitor
4. The display will auto-update every 10 seconds

## Important Notes

- ⚠️ **READ-ONLY**: This app never modifies the scheduling database
- ⚠️ **Depends on Scheduling App**: Must have scheduling app database running
- ⚠️ **Real-time**: Shows current time slot automatically
- ⚠️ **Auto-refresh**: Updates every 10 seconds without manual intervention

## License

Proprietary - ICAN Academy

---

**Created**: October 30, 2025
**Integrated with**: ICAN Scheduling App
